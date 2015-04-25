
var path = require('path');
var async = require('async');
var log = require('npmlog');
var Client = require('ssh2').Client;
var SSH2Shell = require ('ssh2shell');
var glob = require("glob");
var fs = require("fs-extra");
var _ = require("underscore");
var _s = require("underscore.string");

var pkg = require('./package.json');

log.level = process.env['NPM_LOG'] || 'info';

/**
 * sudo challenge completion over ssh
 *
 * @param stream
 * @param pwd
 * @param then
 */
var sudoChallenge = function(stream, pwd, then){

  log.verbose(pkg.name, 'waiting for sudo');

  var hasReceivedData = false;
  var hasChallenge = false;
  var tChallenge = setTimeout(function(){
    log.error(pkg.name, 'login in failed by timeout '+tChallenge);
    stream.removeListener('data', checkPwdInput);
    if (then) then(true);
  }, 10000);

  var checkPwdInput = function(data){

    data = ''+data;
    hasReceivedData = true;

    if(!hasChallenge ){

      if( data.match(/\[sudo\] password/) ){
        hasChallenge = true;
        log.verbose(pkg.name, 'login...');
        stream.write(pwd+'\n');

      }else{

        clearTimeout(tChallenge);
        stream.removeListener('data', checkPwdInput);
        log.verbose(pkg.name, 'login success without a challenge');
        if (then) then(false);

      }

    } else if(hasChallenge){

      clearTimeout(tChallenge);
      stream.removeListener('data', checkPwdInput);

      hasChallenge = false;
      if(data.toString().match(/Sorry, try again/) ){
        log.error(pkg.name, 'login in failed by password');
        if (then) then(true);
      }else{
        log.verbose(pkg.name, 'login in success by password');
        if (then) then(false);
      }
    }
  };
  stream.on('data', checkPwdInput);

  var checkEmptyOutputCommands = function(){
    if(!hasReceivedData && !hasChallenge){
      clearTimeout(tChallenge);
      stream.removeListener('data', checkPwdInput);
      stream.removeListener('data', checkEmptyOutputCommands);
      log.verbose(pkg.name, 'login in success, without a challenge, without a data');
      if (then) then(false);
    }
  };
  stream.on('close', checkEmptyOutputCommands);
};

/**
 *
 * @constructor
 */
function SSH2Utils(){
  this.log = log;
}

/**
 *
 * @param server
 * @param done
 */
var connect = function(server, done){

  if( server instanceof Client ){
    log.silly(pkg.name, 're using existing connection');
    done(false, server);
  }else{
    server.username = server.username || server.userName || server.user; // it is acceptable in order to be config compliant with ssh2shell
    log.silly(pkg.name, '%s@%s:%s',server.username,server.host,server.port);

    var conn = new Client();
    conn.on('ready', function() {
      done(null, conn);
    });

    try{
      conn.connect(server);

      log.verbose(pkg.name, 'connecting');

      conn.on('error',function(stderr){
        if(stderr) log.error(pkg.name, ''+stderr);
        done(stderr,null);
      });
    }catch(ex){
      log.error(pkg.name,''+ex);
      done(ex,null);
    }
  }
};

/**
 *
 * @param conn
 * @param server
 * @param cmd
 * @param done
 */
var sudoExec = function(conn, server, cmd, done){

  var opts = {};
  if(cmd.match(/^sudo/) && ('password' in server) ) opts.pty = true;
  opts.pty = true;

  conn.exec(cmd, opts, function(err, stream) {

    if (err) return done(err);

    stream.stderr.on('data', function(data){
      log.error(pkg.name, '%s', _s.trim(''+data))
    });
    stream.on('data', function(data){
      log.silly(pkg.name, '%s', _s.trim(''+data))
    });

    done(undefined, stream);

    if( opts.pty ){
      sudoChallenge(stream, server['password'], function(hasLoginError){
        if(hasLoginError) log.error(pkg.name,
          'login failure, hasLoginError:%j', hasLoginError);
      });
    }

    // manage user pressing ctrl+C
    var sigIntSent = function(){
      // this is supposed to be compatible : /
      try{
        stream.signal('SIGINT');
      }catch(ex){ console.log(ex) }
      // but only this works with openssh@centos
      try{
        stream.write("\x03");
      }catch(ex){ console.log(ex) }
      conn.end();
    };
    process.on('SIGINT', sigIntSent);
    stream.on('close', function(){
      process.removeListener('SIGINT', sigIntSent);
    });
  });
};

/**
 *
 * @param server Oject|Client
 * @param done
 */
SSH2Utils.prototype.getConnReady = connect;

/**
 * Executes a command and return its output
 *  like child_process.exec.
 * non-interactive
 *
 * also take care of
 * - close the connection once stream is closed
 * - manage sudo cmd
 * - log errors to output
 * - remote program termination with ctrl+C
 *
 * @param server Oject|Client
 * @param cmd
 * @param done
 */
SSH2Utils.prototype.exec = function(server,cmd,done){

  connect(server, function(err,conn){
    if( err ) {
      log.error(pkg.name,err);
      done(true,null,''+err, server)
    } else {
      log.verbose(pkg.name, cmd);

      sudoExec(conn, server, cmd, function(err, stream){
        if (err) throw err;

        var stderr = '';
        var stdout = '';
        stream.stderr.on('data', function(data){
          stderr += data.toString();
        });
        stream.on('data', function(data){
          stdout += data.toString();
        });

        stream.on('close', function(){
          if (done) done(!!stderr, stdout, stderr, server, conn);
        });

      });
    }
  });

};

/**
 * Executes a command and return its stream,
 *  like of child_process.spawn.
 * interactive
 *
 * also take care of
 * - close the connection once stream is closed
 * - manage sudo cmd
 * - log errors to output
 *
 * @param server
 * @param cmd
 * @param done
 */
SSH2Utils.prototype.run = function(server,cmd,done){

  connect(server, function(err,conn){
    if( err ) {
      log.error(pkg.name,err);
      done(true,null,''+err, server)
    } else {
      sudoExec(conn, server, cmd, function(err, stream){

        if (err) throw err;

        if (done) done(false, stream, stream.stderr, server, conn);

      });
    }
  });

};

/**
 * Executes a set of multiple and sequential commands.
 * passive listener.
 *
 * Take care of everything, su sudo ect
 *
 * @param server
 * @param cmds
 * @param cmdComplete
 * @param then
 */
SSH2Utils.prototype.runMultiple = function(server,cmds,cmdComplete,then){

  if(!then){
    then = cmdComplete;
    cmdComplete = null;
  }

  server.userName = server.username || server.userName || server.user;

  log.silly(pkg.name, '%s@%s:%s',server.userName,server.host,server.port);
  log.silly(pkg.name, '%j',cmds);

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
          if(message) log.verbose(pkg.name, 'send '+message );
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
    if(err) log.error(pkg.name,err);
    log.silly(allSessionText);
    if(then) then(err, allSessionText, server);
  });

};

/**
 *
 * @param server
 * @param remoteFile
 * @param localPath
 * @param then
 */
SSH2Utils.prototype.readFile = function(server,remoteFile,localPath, then){

  connect(server, function(err,conn){
    conn.sftp(function(err, sftp){
      if (err) throw err;
      sftp.fastGet(remoteFile, localPath, function(err){
        if (err) throw err;
        if(then) then(err, server, conn);
      });
    });
  });
};

/**
 *
 * @param server
 * @param localFile
 * @param remoteFile
 * @param then
 */
SSH2Utils.prototype.putFile = function(server, localFile, remoteFile, then){

  log.verbose(pkg.name, 'from %s to %s',path.relative(__dirname,localFile),remoteFile);

  connect(server, function(err,conn){

    conn.sftp(function(err, sftp){
      if (err) throw err;

      log.verbose(pkg.name, 'ready');

      var remotePath = path.dirname(remoteFile);
      log.verbose(pkg.name, 'mkdir %s', remotePath);
      sftp.mkdir(remotePath,function(err){
        if(err) log.error(pkg.name, 'mkdir '+err);

        remoteFile = remoteFile.replace(/[\\]/g,'/'); // windows needs this
        log.verbose(pkg.name, 'put %s %s',
          path.relative(process.cwd(),localFile), path.relative(remotePath,remoteFile));
        sftp.fastPut(localFile, remoteFile, function(err){
          if (err) throw err;
          if(err) log.error(pkg.name, 'fastPut '+err);
          if(then) then(err, server, conn);
        });

      });
    });
  });
};

/**
 *
 * @param server
 * @param remoteFile
 * @param then
 */
SSH2Utils.prototype.fileExists = function(server, remoteFile, then){

  log.verbose(pkg.name, 'to %s',remoteFile);

  connect(server, function(err,conn){
    if (err) throw err;
    conn.sftp(function(err, sftp){
      if (err) throw err;
      sftp.open(remoteFile, 'r', function(err, handle){
        if(then) then(err, server, conn);
        if(handle) sftp.close(handle)
      })
    });
  });
};

/**
 *
 * @param server
 * @param remotePath
 * @param then
 */
SSH2Utils.prototype.rmdir = function(server, remotePath, then){

  log.verbose(pkg.name, 'rmdir %s',remotePath);

  connect(server, function(err,conn){
    if (err) throw err;

    sudoExec(conn, server, 'rm -fr '+remotePath, function(err){
      if (err) throw err;
      if(then) then(err, server, conn);
    });
  });
};

/**
 *
 * @param server
 * @param remotePath
 * @param then
 */
SSH2Utils.prototype.mkdir = function(server, remotePath, then){

  log.verbose(pkg.name, 'mkdir %s',remotePath);

  connect(server, function(err,conn){
    if (err) throw err;
    conn.sftp(function(err, sftp){
      if (err) throw err;
      sftp.mkdir(remotePath, function(err){
        if(then) then(err, server, conn);
      })
    });
  });
};

/**
 * @param server
 * @param localPath
 * @param remotePath
 * @param then
 */
SSH2Utils.prototype.putDir = function(server,localPath,remotePath, then){

  connect(server, function sshPutDir(err,conn){
    conn.sftp(function(err, sftp){
      if (err) throw err;

      log.verbose(pkg.name, 'ready');
      var options = {
        cwd: localPath
      };

      // scan local directories
      glob( '**/', options, function (er, dirs) {

        var dirHandlers = [];

        // create root remote directory
        dirHandlers.push(function(done){
          log.verbose(pkg.name, 'mkdir %s', remotePath);
          sftp.mkdir(remotePath,function(err){
            if(err) log.error(pkg.name, 'mkdir '+err);
            done();
          });
        });

        // create remote directories
        dirs.forEach(function(f){
          dirHandlers.push(function(done){
            var to = path.join(remotePath, f).replace(/[\\]/g,'/');
            log.verbose(pkg.name, 'mkdir %s', to);
            sftp.mkdir(to,function(err){
              if(err) log.error(pkg.name,'mkdir '+err);
              done();
            });
          })
        });

        // scan local files
        options.nodir = true;
        glob( '**', options, function (er, files) {

          var filesHandlers = [];

          // push files to remote
          files.forEach(function(f){
            filesHandlers.push(function(done){
              var from = path.join(localPath, f);
              var to = path.join(remotePath, f).replace(/[\\]/g,'/'); // windows needs this
              log.verbose(pkg.name, 'put %s %s',
                path.relative(process.cwd(),from), path.relative(remotePath,to));
              sftp.fastPut(from, to, function(err){
                if(err) log.error(pkg.name, 'fastPut '+err);
                if(done) done();
              });
            })
          });

          // delete root remote directory if it exists
          log.verbose(pkg.name, 'rmdir %s', remotePath);
          sftp.rmdir(remotePath, function(err){
            if(err) log.error(pkg.name,'rmdir '+err);
            // then push the scanned files and directories
            async.parallelLimit(dirHandlers, 4, function(){
              async.parallelLimit(filesHandlers, 4, function(){
                if(then)then(err, server, conn);
              });
            });
          });

        });

      });
    });
  });
};

/**
 *
 * @param server
 * @param remotePath
 * @param localPath
 * @param allDone
 */
SSH2Utils.prototype.getDir = function(server,remotePath,localPath, allDone){

  var that = this;
  server.username = server.username || server.userName || server.user;

  connect(server, function(err,conn){
    conn.sftp(function(err, sftp){
      if (err) throw err;

      log.verbose(pkg.name, 'ready');

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

