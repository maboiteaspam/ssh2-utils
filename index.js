
var path = require('path');
var async = require('async');
var Client = require('ssh2').Client;
var glob = require("glob");
var fs = require("fs-extra");
var through = require('through');
var _ = require("underscore");
var _s = require("underscore.string");

var pkg = require('./package.json');
var debug = require('debug')(pkg.name);



/**
 * @throw err if then is null
 * @param then
 * @param err
 */
var returnOrThrow = function(then, err){
  if(then){
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    then.apply(null, args);
  } else if(err) {
    debug('returnOrThrow '+ err);
    throw err;
  }
};

var scanLocalDirectory = function(localPath, then){
  // scan local directories
  var options = {
    cwd: localPath
  };
  glob( '**/', options, function (er, dirs) {
    // scan local files
    options.nodir = true;
    glob( '**', options, function (er, files) {
      then(dirs, files);
    });
  });
};

/**
 * Server credentials information
 * It can use password or key
 * to login, or run sudo command
 * transparently
 *
 * @note It is a class to support documentation
 * @constructor
 */
function ServerCredentials(){
  this.username = '';
  this.password = '';
  this.host = 'localhost';
  this.port = 22;
  this.privateKey = '';
}

/**
 * sudo challenge completion over ssh
 *
 * If the login succeed, hasLogin is true
 *
 * @param stream Stream
 * @param pwd string
 * @param then callback(bool hasLogin)
 */
var sudoChallenge = function(stream, pwd, then){

  debug('waiting for sudo');

  var hasReceivedData = false;
  var hasChallenge = false;

  // this is a general timeout on the command
  // passed this 10 secs, it fails
  var tChallenge = setTimeout(function(){
    debug('Login has failed by timeout');
    stream.removeListener('data', checkPwdInput);
    if (then) then(true);
  }, 10000);

  var checkPwdInput = function(data){

    data = ''+data;
    hasReceivedData = true;

    // there can t be anything to resolve
    // if the challenge has not been sent
    if(!hasChallenge ){

      // first data is always the challenge
      if( data.match(/\[sudo\] password/) || data.match(/Password:/) ){
        hasChallenge = true;
        debug('Challenge started...');
        // if so send the password on stdin
        stream.write(pwd+'\n');

      }else{

        // otherwise,
        // the command has probably ran successfully
        clearTimeout(tChallenge);
        stream.removeListener('data', checkPwdInput);
        debug('Login done without a challenge');
        if (then) then(false);

      }

      // once the challenge is set,
      // it must be concluded
      // right after it s beginning
    } else if(hasChallenge){

      clearTimeout(tChallenge);
      stream.removeListener('data', checkPwdInput);

      hasChallenge = false;
      // this case handle only en.
      if(data.match(/Sorry, try again/) || data.match(/Password:/) ){
        debug('... Failed to resolve the challenge');
        if (then) then(true);
      }else{
        debug('... Challenge was successfully resolved');
        if (then) then(false);
      }
    }
  };
  stream.on('data', checkPwdInput);

  // this is for commands like rm -f /some
  var checkEmptyOutputCommands = function(){
    if(!hasReceivedData && !hasChallenge){
      clearTimeout(tChallenge);
      stream.removeListener('data', checkPwdInput);
      stream.removeListener('data', checkEmptyOutputCommands);
      debug('Login was done, without a challenge, without a data');
      if (then) then(false);
    }
  };
  stream.on('close', checkEmptyOutputCommands);
};

// todo
// better not to do that as it s a global
process.setMaxListeners(100);
/**
 *
 * @constructor
 */
function SSH2Utils(){}

/**
 * opens ssh connection
 *
 * @param server ServerCredentials
 * @param done (err, ssh2.Client conn)
 */
var connect = function(server, done){

  if(!server){
    throw new Error('missing server parameter')
  }

  if( server instanceof Client ){
    debug('re using existing connection');
    done(false, server);
  }else{
    server.username = server.username || server.userName || server.user; // it is acceptable
    debug('%s@%s:%s',server.username,server.host,server.port);

    if(!server.username){
      throw new Error('invalid server parameter')
    }

    var conn = new Client();
    conn.on('ready', function() {
      Object.keys(server).forEach(function(k){
        if(conn[k]){
          throw 'Cannot redefine existing field '+k+' on ssh2Client object, it already exists.'
        }
        conn[k] = server[k];
      });
      done(null, conn);
    });

    try{
      conn.connect(server);

      debug('connecting');

      conn.on('error',function(stderr){
        if(stderr) debug(''+stderr);
        done(stderr, null);
      });


      // manage process termination
      conn.pendingStreams = [];
      var superEnd = conn.end;
      conn.end = function(){
        conn.pendingStreams.forEach(function(stream){
          stream.kill(conn.pendingStreams.length);
        });
        conn.pendingStreams = [];
        superEnd.call(conn);
      };
      // manage user pressing ctrl+C
      var sigIntSent = function(){
        conn.end();
      };
      process.on('SIGINT', sigIntSent);
      conn.on('close',function(){
        try{
          process.removeListener('SIGINT', sigIntSent);
        }catch(ex){}
      });
      conn.on('end',function(){
        try{
          process.removeListener('SIGINT', sigIntSent);
        }catch(ex){}
      });
    }catch(ex){
      debug(''+ex);
      done(ex, null);
    }
  }
};

/**
 *
 * @param cmd String
 * @param stream Stream
 */
var sendSigInt = function(cmd, stream, length){
  debug('sendSigInt '+cmd);
  try{
    // this is a workaround for more ssh implementations
    for(var i=0;i<length;i++){
      stream.write("\x03");
    }
  }catch(ex){ }
  // this only works with openssh@centos
  try{
    for(var i=0;i<length;i++){
      stream.signal('SIGINT');
    }
  }catch(ex){ }
};

/**
 * Execute a command and returns asap
 *
 * @param conn ssh2.Client
 * @param server ServerCredentials
 * @param cmd String
 * @param done callback(err, ssh2._Channel_ stream)
 */
var sudoExec = function(conn, server, cmd, done){

  var opts = {};

  opts.pty = !!cmd.match(/^su(do\s|\s)/) && ('password' in server);

  debug('cmd %j', cmd);
  debug('pty %j', opts.pty);

  conn.exec(cmd, opts, function(err, stream) {

    if (err) debug('err %j', err);
    if (err) return done(err);

    stream.stderr.on('data', function(data){
      debug('sudoExec stderr %s', _s.trim(''+data))
    });
    stream.on('data', function(data){
      debug('sudoExec stdout %s', _s.trim(''+data))
    });

    if(done) done(null, stream);

    if( opts.pty ){
      sudoChallenge(stream, server['password'], function(hasLoginError){
        if(hasLoginError) debug(
          'login failure, hasLoginError:%j', hasLoginError);
      });
    }

    stream.kill = function(length){
      sendSigInt(cmd, stream, length || 1);
    };
    // manage process termination with open handle
    stream.on('close', function(){
      var k = conn.pendingStreams.indexOf(stream);
      if(k>-1) conn.pendingStreams.splice(k,1);
    });
    conn.pendingStreams.push(stream);
  });
};

/**
 * @see connect
 */
SSH2Utils.prototype.getConnReady = connect;

/**
 * Executes a command and return its output
 *  like child_process.exec.
 * non-interactive
 *
 * also take care of
 * - remote program termination with ctrl+C
 *
 * @param server ServerCredentials|ssh2.Client
 * @param cmd String
 * @param done callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.execOne = function(server, cmd, done){

  connect(server, function(err, conn){
    if( err) return returnOrThrow(done, err, '', ''+err, server, conn);

    sudoExec(conn, server, cmd, function(err, stream){
      if( err) return returnOrThrow(done, err, '', ''+err, server, conn);

      var stderr = '';
      var stdout = '';
      stream.stderr.on('data', function(data){
        stderr += data.toString();
      });
      stream.on('data', function(data){
        stdout += data.toString();
      });

      stream.on('close', function(){
        var fineErr = null;
        if(stderr){
          fineErr = new Error(_s.trim(stderr));
          debug('stdout %j', stdout);
          debug('stderr %j', stderr);
        }
        returnOrThrow(done, fineErr, stdout, stderr, server, conn);
      });
    });
  });

};

/**
 * Executes a command and return its output
 *  like child_process.exec.
 * non-interactive
 *
 * also take care of
 * - remote program termination with ctrl+C
 *
 * If cmd is an array of string,
 * they are executed in serie,
 * respective output of each stdout / stderr is join then returned.
 *
 * @param server ServerCredentials|ssh2.Client
 * @param cmd String|[String]
 * @param doneEach callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)
 * @param done callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.exec = function(server, cmd, doneEach, done){

  var that = this;
  if(_.isString(cmd)){
    cmd = [cmd];
  }
  if(!done&& _.isFunction(doneEach) ){
    done = doneEach;
    doneEach = null;
  }
  var cmds = [];
  var conn_;
  var err_;
  var stdout_ = '';
  var stderr_ = '';
  cmd.forEach(function(c){
    cmds.push(function(next){
      that.execOne(conn_ || server, c, function(err, stdout, stderr, server, conn){
        conn_ = conn;
        err_ = err;
        stdout_ += stdout;
        stderr_ += stderr;
        if(doneEach) doneEach(err, stdout, stderr, server, conn);
        next();
      });
    });
  });

  async.series(cmds, function(){
    returnOrThrow(done, err_, stdout_, stderr_, server, conn_);
  });

};

/**
 * Executes a command and return its stream,
 *  like of child_process.spawn.
 * interactive
 *
 * also take care of
 * - manage sudo cmd
 * - log errors to output
 *
 * If cmd is an array, they are executed in serie,
 * the pipe is open asap,
 * you ll receive each stdout stderr data in serie
 *
 * @param server ServerCredentials|ssh2.Client
 * @param cmd String|[String]
 * @param doneEach callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)
 * @param done callback(bool err, Stream stdout, Stream stderr, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.run = function(server, cmd, doneEach, done){
  var stdoutStream = through();
  var stderrStream = through();
  if(_.isString(cmd)){
    cmd = [cmd];
  }
  if(!done&& _.isFunction(doneEach) ){
    done = doneEach;
    doneEach = null;
  }
  var cmds = [];
  var conn_;
  var err_;
  var stream_;
  connect(server, function(err, conn){
    if(err) return returnOrThrow(done, err, null, ''+err, server, conn);
    cmd.forEach(function(c, i){
      cmds.push(function(next){
        sudoExec(conn, server, c, function(err, stream){
          if(err) return returnOrThrow(done, err, stream, stream.stderr, server, conn);

          conn_ = conn;
          err_ = err;

          (function(stream, i){
            var onStdoutData = function(d){
              stdoutStream.emit('data', d);
            };
            var onStderrData = function(d){
              stderrStream.emit('data', d);
            };
            stream.on('data', onStdoutData);
            stream.stderr.on('data', onStderrData);
            var onClose = function(err){
              setTimeout(function(){
                if(i===cmds.length){
                  stdoutStream.emit('close', err);
                }
                stream.removeListener('close', onClose);
                stream.removeListener('data', onStdoutData);
                stream.stderr.removeListener('data', onStderrData);
              },500);
            };
            stream.on('close', onClose);
          })(stream, i+1);

          if(!stream_){ // execute only once
            returnOrThrow(done, err, stdoutStream, stderrStream, server, conn);
          }

          if(doneEach) doneEach(err, stream, stream.stderr, server, conn);

          stream_ = stream;
          next();

        });
      })
    });

    async.series(cmds, function(){
      if(!stream_){
        returnOrThrow(done, err_, stdoutStream, stderrStream, server, conn_);
      }
    });

  });

};

/**
 * Executes a set of multiple and sequential commands.
 *
 * @param server ServerCredentials|ssh2.Client
 * @param cmds [String]
 * @param cmdComplete callback(String command, String response, ServerCredentials server)
 * @param then callback(err, String allSessionText, ServerCredentials server)
 */
SSH2Utils.prototype.runMultiple = SSH2Utils.prototype.run;

/**
 * Reads a file on the remote
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param then callback(err, String content, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.readFile = function(server, remoteFile, then){

  var content = '';
  connect(server, function(err, conn){
    if(err) return returnOrThrow(then, err, content, server, conn);

    conn.sftp(function(err, sftp){
      if(err) return returnOrThrow(then, err, content, server, conn);

      debug('createReadStream %s', remoteFile);
      var stream = sftp.createReadStream(remoteFile);
      stream.on('data', function(d){
        content += ''+d;
      });
      var finish = function(readErr){
        stream.removeListener('error', finish);
        stream.removeListener('close', finish);
        returnOrThrow(then, readErr, content, server, conn);
      };
      stream.on('error', finish);
      stream.on('close', finish);
    });
  });
};

/**
 * Reads a file on the remote via sudo
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param then callback(err, String content, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.readFileSudo = function(server, remoteFile, then){

  var content = '';
  this.run(server, 'sudo cat '+remoteFile+'', function(err, stdout, stderr, server, conn){
    if(err) return returnOrThrow(then, err, content, server, conn);

    var readErr;
    stdout.on('data', function(d){
      content += ''+d;
    });
    stdout.on('error', function(e){
      readErr = e;
    });
    stdout.on('close', function(){
      returnOrThrow(then, readErr, content, server, conn);
    });
  });
};

/**
 * Reads a large file on the remote
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param then callback(err, Stream data, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.streamReadFile = function(server, remoteFile, then){

  connect(server, function(err,conn){
    conn.sftp(function(err, sftp){
      var stream = sftp.createReadStream(remoteFile);
      returnOrThrow(then, err, stream, server, conn);
    });
  });
};

/**
 * Reads a large file on the remote via sudo
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param then callback(err, Stream data, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.streamReadFileSudo = function(server, remoteFile, then){
  this.run(server, 'sudo cat '+remoteFile+'', function(err, stdout, stderr, server, conn){
    returnOrThrow(then, err, stdout, server, conn);
  });
};

/**
 * Downloads a file to the local
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param localPath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.getFile = function(server, remoteFile, localPath, then){

  connect(server, function(err,conn){
    conn.sftp(function(err, sftp){
      if(err) return returnOrThrow(then, err, server, conn);
      sftp.fastGet(remoteFile, localPath, function(err){
        returnOrThrow(then, err, server, conn);
      });
    });
  });
};

/**
 * Ensure a remote file contains a certain text piece of text
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param contain String
 * @param then callback(err, Bool contains, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.ensureFileContains = function(server, remoteFile, contain, then){
  var that = this;
  that.exec(server, 'grep "'+contain+'" '+remoteFile, function(err, stdout, stderr, server, conn){
    var found = stdout.length>0 && stdout.match(contain);
    if(found){
      then(err, true, server, conn);
    } else {
      that.exec(conn, 'echo "'+contain+'" >> '+remoteFile+'', function(err, stdout, stderr, server, conn){
        that.exec(conn, 'grep "'+contain+'" '+remoteFile, function(err, stdout, stderr, server, conn){
          then(err, (stdout.length>0 && stdout.match(contain)), server, conn);
        });
      });
    }
  });
};

/**
 * Ensure a remote file contains a certain text piece of text
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param contain String
 * @param then callback(err, Bool contains, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.ensureFileContainsSudo = function(server, remoteFile, contain, then){
  var that = this;
  that.exec(server, 'sudo grep "'+contain+'" '+remoteFile, function(err, stdout, stderr, server, conn){
    var found = stdout.length>0 && stdout.match(contain);
    if(found){
      then(err, true, server, conn);
    } else {
      that.exec(conn, 'sudo echo "'+contain+'" >> '+remoteFile, function(err,stdout,stderr,server,conn){
        then(err, !!err, server, conn);
      });
    }
  });
};
/**
 * Ensure a remote file contains a certain text piece of text
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param content String
 * @param then callback(err, Bool contains, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.prependFile = function(server, remoteFile, content, then){
  var that = this;
  that.mktemp(server, pkg.name, function(err, tmpPath, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);
    that.writeFile(server, tmpPath+'/t', content, function(err){
      if(err) return returnOrThrow(then, err, server, conn);
      that.exec(server, 'echo '+remoteFile+' >> '+tmpPath+'/t', content, function(err){
        if(err) return returnOrThrow(then, err, server, conn);
        that.exec(server, 'echo '+tmpPath+'/t > '+remoteFile, content, function(err){
          if(err) return returnOrThrow(then, err, server, conn);
          that.exec(server, 'rm '+tmpPath+'/t ', content, function(err){
            if(err) return returnOrThrow(then, err, server, conn);
          });
        });
      });
    });
  });
};

/**
 * Ensure a remote file contains a certain text piece of text
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param content String
 * @param then callback(err, Bool contains, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.prependFileSudo = function(server, remoteFile, content, then){
  var that = this;
  that.mktemp(server, pkg.name, function(err, tmpPath, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);
    that.writeFileSudo(server, tmpPath+'/t', content, function(err){
      if(err) return returnOrThrow(then, err, server, conn);
      that.exec(server, 'sudo echo '+remoteFile+' >> '+tmpPath+'/t', content, function(err){
        if(err) return returnOrThrow(then, err, server, conn);
        that.exec(server, 'sudo echo '+tmpPath+'/t > '+remoteFile, content, function(err){
          if(err) return returnOrThrow(then, err, server, conn);
          that.exec(server, 'sudo rm '+tmpPath+'/t ', content, function(err){
            if(err) return returnOrThrow(then, err, server, conn);
          });
        });
      });
    });
  });
};

/**
 * Uploads a file on the remote remote
 *
 * @param server ServerCredentials|ssh2.Client
 * @param localFile String
 * @param remoteFile String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.putFile = function(server, localFile, remoteFile, then){

  debug('from %s to %s', path.relative(__dirname,localFile), remoteFile);

  remoteFile = remoteFile.replace(/[\\]/g,'/'); // windows needs this
  var remotePath = path.dirname(remoteFile);
  this.mkdir(server, remotePath, function(err, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);

    conn.sftp(function(err, sftp){
      if(err) return returnOrThrow(then, err, server, conn);

      debug('put %s %s',
        path.relative(process.cwd(),localFile), path.relative(remotePath,remoteFile));

      sftp.fastPut(localFile, remoteFile, function(err){
        returnOrThrow(then, err, server, conn);
      });
    });
  });

};

/**
 * Uploads a file on the remote via sudo support
 *
 * @param server ServerCredentials|ssh2.Client
 * @param localFile String
 * @param remoteFile String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.putFileSudo = function(server, localFile, remoteFile, then){

  var that = this;

  debug('from %s to %s', path.relative(__dirname, localFile), remoteFile);

  remoteFile = remoteFile.replace(/[\\]/g,'/'); // windows needs this
  var remotePath = path.dirname(remoteFile);
  var fileName = path.basename(remoteFile);

  this.mktemp(server, pkg.name, function(err, tmpPath, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);

    conn.sftp(function(err, sftp){
      if(err) return returnOrThrow(then, err, server, conn);

      debug('put %s %s',
        path.relative(process.cwd(), localFile), path.relative(remotePath, remoteFile));

      sftp.fastPut(localFile, tmpPath+'/'+fileName, function(err){
        if(err) return returnOrThrow(then, err, server, conn);

        that.mkdirSudo(conn,remotePath, function(err){
          if(err) return returnOrThrow(then, err, server, conn);

          that.exec(conn, 'sudo cp '+tmpPath+'/'+fileName+' '+remoteFile, function(err, stdout, stderr){
            if(err) return returnOrThrow(then, err, server, conn);

            that.rmdirSudo(conn, tmpPath+'/'+fileName, function(err){
              returnOrThrow(then, err, server, conn);
            });

          });

        });

      });
    });
  });

};

/**
 * Writes content to a remote file
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param content String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.writeFile = function(server, remoteFile, content, then){

  debug('write to %s',remoteFile);

  remoteFile = remoteFile.replace(/[\\]/g,'/'); // windows needs this

  var remotePath = path.dirname(remoteFile);
  debug('mkdir %s', remotePath);
  this.mkdir(server, remotePath, function(err, server, conn){
    if(err){
      return returnOrThrow(then, err, server, conn);
    }

    debug('write %s', remoteFile);

    conn.sftp(function sftpOpen(err, sftp){
      if(err){
        return returnOrThrow(then, err, server, conn);
      }
      try{
        debug('stream start');
        var wStream = sftp.createWriteStream(remoteFile, {flags: 'w+', encoding: null});
        wStream.on('error', function (err) {
          debug('stream error %j', err);
          wStream.removeAllListeners('finish');
          returnOrThrow(then, err, server, conn);
        });
        wStream.on('finish', function () {
          debug('stream finish');
          returnOrThrow(then, err, server, conn);
        });
        wStream.end(''+content);
      }catch(ex){
        debug('stream ex %j', ex);
        return returnOrThrow(then, ex, server, conn);
      }
    });
  });
};

/**
 * Writes content to a remote file
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param content String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.writeFileSudo = function(server, remoteFile, content, then){
  throw 'todo';
};

/**
 * Tells if a file exists on remote
 * by trying to open handle on it.
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param then callback(err, exists, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.fileExists = function(server, remoteFile, then){

  remoteFile = remoteFile.replace(/[\\]/g,'/'); // windows needs this
  debug('fileExists %s',remoteFile);

  connect(server, function sshConnect(err, conn){
    if (err) return returnOrThrow(then, err, server, conn);
    conn.sftp(function sftpOpen(err, sftp){
      if (err) return returnOrThrow(then, err, server, conn);
      sftp.open(remoteFile, 'r', function stfpOpenFileHandle(err, handle){
        if(handle) sftp.close(handle);
        returnOrThrow(then, err, !err, server, conn);
      })
    });
  });
};

/**
 * Tells if a file exists on remote
 * by trying to open handle on it.
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remoteFile String
 * @param then callback(err, exists, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.fileExistsSudo = function(server, remoteFile, then){

  remoteFile = path.normalize(remoteFile).replace(/\\/g, '/');
  var remoteFileName = path.basename(remoteFile);
  var remotePath = path.dirname(remoteFile);
  debug('fileExistsSudo %s', remoteFile);

  this.exec(server, 'sudo ls -alh '+remotePath+'/', function(err, stdout, stderr, server, conn){
    returnOrThrow(then, err, !!stdout.match(remoteFileName), server, conn);
  });
};

/**
 * Deletes a file or directory
 * rm -fr /some/path
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.rmdir = function(server, remotePath, then){
  debug('rmdir %s',remotePath);
  this.exec(server, 'rm -fr '+remotePath, function rmdir (err, stderr, stdout, server, conn){
    var fineErr = null;
    if( stdout ){
      fineErr = new  Error(stdout);
      fineErr.code = 3;
    }
    returnOrThrow(then, fineErr, server, conn);
  });
};

/**
 * Deletes a file or directory
 * sudo rm -fr /some/path
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.rmdirSudo = function(server, remotePath, then){
  debug('rmdirSudo %s', remotePath);
  this.exec(server, 'sudo rm -fr '+remotePath, function rmdirSudo (err, stderr, stdout, server, conn){
    var fineErr = null;
    if( stdout ){
      fineErr = new  Error(stdout);
      fineErr.code = 3;
    }
    returnOrThrow(then, fineErr, server, conn);
  });
};

/**
 * Creates a concurrent-safe temporary remote directory.
 *
 * It does not attempt to keep track of temp files created during the session.
 * Thus it won t delete them on connection close.
 *
 * @param server ServerCredentials|ssh2.Client
 * @param suffix String
 * @param then callback(err, tmpDirName, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.mktemp = function(server, suffix, then){
  debug('mktemp %s',suffix);
  this.exec(server, 'mktemp -d --suffix='+suffix, function mkdir (err, stderr, stdout, server, conn){
    // if response is done on stderr when everything s fine,
    // errors may go into stdout or fd.pipe[3], it is unclear and for sure untested
    var tempPath = _s.trim(stderr);
    returnOrThrow(then, null, tempPath, server, conn);
  });
};

/**
 * Creates a remote directory
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.mkdir = function(server, remotePath, then){
  debug('mkdir %s',remotePath);
  this.exec(server, 'mkdir -p '+remotePath, function mkdir (err, stderr, stdout, server, conn){
    var fineErr = null;
    if( stdout ){
      fineErr = new  Error(stdout);
      fineErr.code = 3;
    }
    returnOrThrow(then, fineErr, server, conn);
  });
};

/**
 * Creates a remote directory
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.mkdirSudo = function(server, remotePath, then){
  debug('mkdirSudo %s',remotePath);
  this.exec(server, 'sudo mkdir -p '+remotePath, function mkdirSudo (err, stderr, stdout, server, conn){
    var fineErr = null;
    if( stdout ){
      fineErr = new  Error(stdout);
      fineErr.code = 3;
    }
    returnOrThrow(then, fineErr, server, conn);
  });
};

/**
 * Ensure a remote directory exists and is empty
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.ensureEmptyDir = function(server, remotePath, then){
  debug('ensureEmptyDir %s',remotePath);
  var that = this;
  that.rmdir(server, remotePath, function(err, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);
    that.mkdir(server, remotePath, function(err, server, conn){
      returnOrThrow(then, err, server, conn);
    });
  });
};

/**
 * Ensure a remote directory exists and is empty
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.ensureEmptyDirSudo = function(server, remotePath, then){
  debug('ensureEmptyDir %s',remotePath);
  var that = this;
  that.rmdirSudo(server, remotePath, function(err, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);
    that.mkdirSudo(server, remotePath, function(err, server, conn){
      returnOrThrow(then, err, server, conn);
    });
  });
};

/**
 * Ensure a file belongs to connected user
 * by sudo chmod -R /path
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.ensureOwnership = function(server, remotePath, then){
  debug('ensureWritable %s',remotePath);
  var that = this;
  server.username = server.username || server.userName || server.user;
  that.exec(server, 'sudo chown -R '+server.username+':'+server.username+' '+remotePath, function(err, stdout, stderr, server, conn) {
    returnOrThrow(then, err, server, conn);
  });
};

/**
 * Uploads a local directory to the remote.
 * Partly in series, partly parallel.
 * Proceed such
 * sudo rm -fr /remotePath
 * sudo mkdir -p /remotePath
 * recursive sftp mkdir
 * recursive sftp put
 *
 * @param server ServerCredentials|ssh2.Client
 * @param localPath String
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.putDir = function(server, localPath, remotePath, then){
  var that = this;
  that.ensureEmptyDir(server, remotePath, function(err, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);

    conn.sftp(function(err, sftp){
      if(err) return returnOrThrow(then, err, server, conn);

      debug('ready');
      scanLocalDirectory(localPath, function(dirs, files){

        // create remote directories
        var dirHandlers = [];
        dirs.forEach(function(f){
          dirHandlers.push(function(next){
            var to = path.join(remotePath, f).replace(/[\\]/g,'/'); // windows needs this
            debug(pkg.name, 'mkdir %s', to);
            that.mkdir(server, to, function(err){
              if(err) debug('mkdir %s %s', to, err.message);
              next();
            });
          })
        });

        // push files to remote
        var filesHandlers = [];
        files.forEach(function(f){
          filesHandlers.push(function(next){
            var from = path.join(localPath, f);
            var to = path.join(remotePath, f).replace(/[\\]/g,'/'); // windows needs this
            debug(pkg.name, 'put %s %s', path.relative(process.cwd(), from), to);
            sftp.fastPut(from, to, function(err){
              if(err) debug('fastPut %s %s %s', from, to, err.message);
              next();
            });
          })
        });

        // then push the scanned files and directories
        async.series(dirHandlers, function(){
          async.parallelLimit(filesHandlers, 4, function(){
            returnOrThrow(then, err, server, conn);
          });
        });
      });
    });
  });
};

/**
 * Uploads a local directory to the remote.
 * Partly in series, partly parallel.
 * Proceed such
 * sudo rm -fr /remotePath
 * sudo mkdir -p /remotePath
 * recursive sftp mkdir
 * recursive sftp put
 *
 * @param server ServerCredentials|ssh2.Client
 * @param localPath String
 * @param remotePath String
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.putDirSudo = function(server, localPath, remotePath, then){

  var that = this;

  var tmpRemotePath = path.join('/tmp/ssh2-utils/', remotePath);
  that.ensureEmptyDirSudo(server, remotePath, function(err, server, conn){
    if(err) return returnOrThrow(then, err, server, conn);

    that.ensureEmptyDirSudo(conn, tmpRemotePath, function(err, server, conn){
      if(err) return returnOrThrow(then, err, server, conn);

      that.ensureOwnership(conn, tmpRemotePath, function(err, server, conn) {
        if (err) return returnOrThrow(then, err, server, conn);

        conn.sftp(function(err, sftp){
          if(err) return returnOrThrow(then, err, server, conn);

          debug('ready');
          scanLocalDirectory(localPath, function(dirs, files){

            // create remote directories
            var dirHandlers = [];
            dirs.forEach(function(f){
              dirHandlers.push(function(next){
                var to = path.join(tmpRemotePath, f).replace(/[\\]/g,'/');
                debug(pkg.name, 'mkdir %s', to);
                that.mkdirSudo(to, function(err){
                  if(err) debug('mkdir %s %s', to, err.message);
                  next();
                });
              })
            });

            // push files to remote
            var filesHandlers = [];
            files.forEach(function(f){
              filesHandlers.push(function(next){
                var from = path.join(localPath, f);
                var to = path.join(tmpRemotePath, f).replace(/[\\]/g,'/'); // windows needs this
                debug(pkg.name, 'put %s %s', path.relative(process.cwd(), from), to);
                sftp.fastPut(from, to, function(err){
                  if(err) debug('fastPut %s %s %s', from, to, err.message);
                  next();
                });
              })
            });

            // then push the scanned files and directories
            async.series(dirHandlers, function(){
              async.parallelLimit(filesHandlers, 4, function(){
                if(err) return returnOrThrow(then, err, server, conn);
                that.exec(conn, 'sudo cp -R '+path.join(tmpRemotePath, '*')+' '+remotePath+'/', function(err, stdout, stderr, server, conn){
                  if(err) return returnOrThrow(then, err, server, conn);
                  that.rmdirSudo(conn, tmpRemotePath, function(err, server, conn){
                    returnOrThrow(then, err, server, conn);
                  });
                });
              });
            });
          });
        });

      });


    });
  });

};

/**
 * Downloads a remote directory to the local.
 * remote traverse directories over sftp.
 * then get files in parallel
 *
 * @param server ServerCredentials|ssh2.Client
 * @param remotePath String
 * @param localPath String
 * @param allDone callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.getDir = function(server, remotePath, localPath, allDone){

  var that = this;
  server.username = server.username || server.userName || server.user;

  connect(server, function(err,conn){
    conn.sftp(function(err, sftp){
      if (err) throw err;

      debug('ready');

      var files = [];
      var dirs = [];
      function readdir(p, then){
        sftp.readdir(p, function sftpReaddir(err,list){
          if (err) throw err;
          var toRead = [];
          list.forEach(function(item){
            var fpath = p+'/'+item.filename;
            toRead.push(function(done){
              sftp.stat(fpath, function sftpStats(err,stat){
                if (err) throw err;
                if(stat.isDirectory()){
                  dirs.push(fpath.replace(remotePath, '' ) );
                  readdir(fpath,done);
                }else if(stat.isFile()){
                  files.push(fpath.replace(remotePath, '' ) );
                  done();
                }
              });
            });
          });
          async.parallelLimit(toRead,4, function(){
            if(then) then(dirs,files);
          });
        });
      }

      readdir(remotePath, function(dirs,files){
        var todoDirs = [];
        var todoFiles = [];
        dirs.forEach(function(dir){
          todoDirs.push(function(done){
            fs.mkdirs(localPath+dir,done);
          });
        });
        files.forEach(function(file){
          todoFiles.push(function(done){
            that.readFile(server, remotePath+file, localPath+file, done);
          });
        });

        async.parallelLimit(todoDirs,4, function(){
          async.parallelLimit(todoFiles,4, allDone);
        });
      });

    });
  });
};

module.exports = SSH2Utils;
