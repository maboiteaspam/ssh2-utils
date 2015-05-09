
var path = require('path');
var async = require('async');
var Client = require('ssh2').Client;
var SSH2Shell = require ('ssh2shell');
var glob = require("glob");
var fs = require("fs-extra");
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
 * @note It is a class to only support documentation
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
 * If the login success, hasLogin is true
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
    server.username = server.username || server.userName || server.user; // it is acceptable in order to be config compliant with ssh2shell
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
    }catch(ex){
      debug(''+ex);
      done(ex, null);
    }
  }
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
    }else{

    }

    // manage user pressing ctrl+C
    var sigIntSent = function(){
      // this is supposed to be compatible : /
      try{
        stream.signal('SIGINT');
      }catch(ex){ console.log(ex) }
      // but this only works with openssh@centos
      try{
        // this is a workaround for more ssh implementations
        stream.write("\x03");
      }catch(ex){ console.log(ex) }
      setTimeout(function(){
        conn.end();
        // if the connection ends to soon,
        // suspect the remote process is not killed.
      },2000);
    };
    process.on('SIGINT', sigIntSent);
    stream.on('close', function(){
      process.removeListener('SIGINT', sigIntSent);
    });
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
 * - manage sudo cmd
 * - log errors to output
 * - remote program termination with ctrl+C
 *
 * @param server ServerCredentials|ssh2.Client
 * @param cmd String
 * @param done callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.exec = function(server, cmd, done){

  connect(server, function(err, conn){
    if( err) return returnOrThrow(done, err, null,''+err, server, conn);

    sudoExec(conn, server, cmd, function(err, stream){
      if( err) return returnOrThrow(done, err, null,''+err, server, conn);

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
 * Executes a command and return its stream,
 *  like of child_process.spawn.
 * interactive
 *
 * also take care of
 * - manage sudo cmd
 * - log errors to output
 *
 * @param server ServerCredentials|ssh2.Client
 * @param cmd String
 * @param done callback(bool err, Stream stdout, Stream stderr, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.run = function(server, cmd, done){
  connect(server, function(err, conn){
    if(err) return returnOrThrow(done, err, null, ''+err, server, conn);
    sudoExec(conn, server, cmd, function(err, stream){
      returnOrThrow(done, err, stream, stream.stderr, server, conn);
    });
  });

};

/**
 * Executes a set of multiple and sequential commands.
 * passive listener.
 *
 * Take care of everything, su sudo ect
 *
 * @param server ServerCredentials|ssh2.Client
 * @param cmds [String]
 * @param cmdComplete callback(String command, String response, ServerCredentials server)
 * @param then callback(err, String allSessionText, ServerCredentials server)
 */
SSH2Utils.prototype.runMultiple = function(server, cmds, cmdComplete, then){

  if(!then){
    then = cmdComplete;
    cmdComplete = null;
  }

  server.userName = server.username || server.userName || server.user;

  debug('%s@%s:%s',server.userName,server.host,server.port);
  debug('%j',cmds);

  var allSessionText = '';

  var host = {
    server:server,
    idleTimeOut:1000,
    connectedMessage:true,
    readyMessage:true,
    closedMessage:true,
    commands: [].concat(cmds), // very important to clone
    msg: {
      send: function( message ) {
        if(message!=true ){
          message = _s.trim(message);
          allSessionText += message;
          if(message) debug('send '+message );
        }
      }
    },
    onCommandComplete: function( command, response, sshObj ) {
      command = _s.trim(command)
      response = _s.trim(response)
      if(response&&command){
        // trim the command of redundant output
        response = response.split('\n');
        response.shift();
        response.pop();
        response = response.join('\n');
      }
      if(command){
        allSessionText += server.userName+'@'+server.host;
        allSessionText += '> '+command+'\n';
        if(response) allSessionText += ''+response+'\n';
      }
      if(cmdComplete) cmdComplete(command, response, server);
    },
    onEnd: function( sessionText, sshObj ) {
    }
  };
  var SSH = new SSH2Shell(host);
  SSH.connect();

  SSH.on("close", function onError(err) {
    if(err) debug(err);
    debug(allSessionText);
    if(then) then(err, allSessionText, server);
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
SSH2Utils.prototype.readFile = function(server, remoteFile, localPath, then){

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
 * @param then callback(err, ServerCredentials server, ssh2.Client conn)
 */
SSH2Utils.prototype.ensureFileContains = function(server, remoteFile, contain, then){
  var that = this;
  that.exec(server, 'grep "'+contain+'" '+remoteFile, function(err, stdout, stderr, server, conn){
    if(stdout.length>0){
      then(true, err, stdout, stderr, server, conn)
    } else {
      that.exec(conn, 'echo "'+contain+'" >> '+remoteFile, function(err,stdout,stderr,server,conn){
        then(!!err, err, stdout, stderr, server, conn);
      });
    }
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

  connect(server, function(err,conn){

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
        wStream.end(''+content);
        wStream.on('error', function (err) {
          debug('stream error %j', err);
          wStream.removeAllListeners('finish');
          returnOrThrow(then, err, server, conn);
        });
        wStream.on('finish', function () {
          debug('stream finish');
          returnOrThrow(then, err, server, conn);
        });
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

  var remotePath = path.dirname(remoteFile);
  var remoteFileName = path.basename(remoteFile);
  debug('fileExistsSudo %s', remoteFile);

  this.exec(server, 'sudo ls -alh '+remotePath, function(err, stdout, stderr, server, conn){
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
SSH2Utils.prototype.getDir = function(server,remotePath,localPath, allDone){

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
