
var path = require('path');
var async = require('async');
var through = require('through');
var log = require('npmlog');
var Client = require('ssh2').Client;
var SSH2Shell = require ('ssh2shell');
var glob = require("glob");
var _ = require("underscore");
var _s = require("underscore.string");

var pkg = require('./package.json');

/**
 * sudo challenge completion over ssh
 *
 * @param stream
 * @param pwd
 * @param then
 */
var sudoChallenge = function(stream, pwd, then){
  log.verbose('ssh', 'waiting for sudo');
  var hasChallenge = false;
  var tChallenge = setTimeout(function(){
    log.error('ssh', 'login in failed by timeout');
    stream.removeListener('data', checkPwdInput);
    if (then) then(true);
  },10000);
  var checkPwdInput = function(data){
    if(!hasChallenge && data.toString().match(/\[sudo\] password/) ){
      hasChallenge = true;
      log.verbose('ssh', 'login...');
      stream.removeListener('data', checkPwdLessInput);
      stream.write(pwd+'\n');
    } else if(hasChallenge){
      clearTimeout(tChallenge);
      stream.removeListener('data', checkPwdInput);
      hasChallenge = false;
      if(data.toString().match(/Sorry, try again/) ){
        log.error('ssh', 'login in failed by password');
        if (then) then(true);
      }else{
        log.verbose('ssh', 'login in success by password');
        if (then) then(false);
      }
    }
  };
  var checkPwdLessInput = function(){
      if(!hasChallenge){
        clearTimeout(tChallenge)
        stream.removeListener('data', checkPwdInput);
        log.verbose('ssh', 'login in success by timeout');
        if (then) then(false);
      }
  };
  stream.on('data', checkPwdInput);
  stream.once('data', checkPwdLessInput);
};

/**
 *
 * @constructor
 */
function SSH2Utils(){
  this.log = log;
}

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

  var execOnConn = function(conn){
    var opts = {};
    if(cmd.match(/^sudo/) && ('password' in server) ) opts.pty = true;
    opts.pty = true;

    if(!conn.server) conn.server = server;

    log.verbose(pkg.name, cmd);

    conn.exec(cmd, opts, function(err, stream) {

      if (err) throw err;

      var stderr = '';
      var stdout = '';
      stream.stderr.on('data', function(data){
        log.error('exec', 'STDERR: %s', data);
        stderr += data.toString();
      });
      stream.on('data', function(data){
        log.silly(data)
        stdout += data.toString();
      });

      if( opts.pty ){
        sudoChallenge(stream, conn.server['password'], function(success){
          log.verbose('challenge done, error:%j', success);
          var tout;
          var triggerOnceFinished = function(){
            clearTimeout(tout)
            tout = setTimeout(function(){
              stream.removeListener('data',triggerOnceFinished);
              stream.stderr.removeListener('data',triggerOnceFinished);
              if (done) done(success, stdout, stderr, server, conn);
            },250);
          };
          stream.on('data', triggerOnceFinished);
          stream.stderr.on('data', triggerOnceFinished);
          triggerOnceFinished();
        });
      }else {
        var tout;
        var triggerOnceFinished = function(){
          clearTimeout(tout)
          tout = setTimeout(function(){
            stream.removeListener('data',triggerOnceFinished);
            stream.stderr.removeListener('data',triggerOnceFinished);
            if (done) done(false, stdout, stderr, server, conn);
          },250);
        };
        stream.on('data', triggerOnceFinished);
        stream.stderr.on('data', triggerOnceFinished);
        triggerOnceFinished();
      }
    });
  };

  if(server instanceof Client ){
    execOnConn(server);
  }else{

    var conn = new Client();

    server.username = server.username || server.userName; // it is acceptable in order to be config compliant with ssh2shell

    log.silly(pkg.name, '%s@%s:%s',server.username,server.host,server.port);

    conn.on('ready', function() {
      execOnConn(conn);
    });

    try{
      conn.connect(server);

      log.verbose(pkg.name, 'connecting');

      conn.on('error',function(stderr){
        log.error(''+stderr)
        done(true,null,''+stderr, server)
      });
    }catch(ex){
      log.error(''+ex)
      done(true,null,''+ex, server)
    }
  }


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

  var runOnConn = function(conn){
    var opts = {};
    if(cmd.match(/^sudo/) && ('password' in server) ) opts.pty = true;

    log.verbose(pkg.name, cmd);

    conn.exec(cmd, opts, function(err, stream) {

      if (err) throw err;
      var stderr = '';
      var stdout = '';
      stream.stderr.on('data', function(data){
        log.error('exec', 'STDERR: %s', data);
        stderr = ''+data;
      });
      stream.on('data', function(data){
        log.silly(data)
        stdout = ''+data;
      });
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

      if( opts.pty ){
        sudoChallenge(stream, server['password'], function(success){
          var rstderr = through().pause();
          var rstdout = through().pause();
          if (done) done(success, rstdout, rstderr, server, conn);
          if(stderr) rstderr.queue(''+stderr+'');
          if(stdout) rstdout.queue(''+stdout+'');
          stream.stderr.pipe(rstderr);
          stream.pipe(rstdout);
          rstdout.resume()
          rstderr.resume()
        });
      }else {
        if (done) done(false, stream, stream.stderr, server, conn);
      }
    });
  };

  if( server instanceof Client ){
    runOnConn(server)
  } else {
    var conn = new Client();

    server.username = server.username || server.userName || server.user; // it is acceptable in order to be config compliant with ssh2shell

    log.silly(pkg.name, '%s@%s:%s',server.username,server.host,server.port);

    conn.on('ready', function() {
      runOnConn(conn)
    });

    try{
      conn.connect(server);

      log.verbose(pkg.name, 'connecting');

      conn.on('error',function(stderr){
        log.error('event '+stderr)
        var Readable = require('stream').Readable;
        var rs = new Readable;
        done(true,null,''+stderr, server)
        rs.push(stderr.toString());
        rs.push(null);
      });

    }catch(ex){
      log.error('connect '+ex)
      var Readable = require('stream').Readable;
      var rs = new Readable;
      done(true,null,''+ex, server)
      rs.push(ex.toString());
      rs.push(null);
    }
  }

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
          if(message) log.verbose(pkg.name, message );
        }
      }
    },
    onCommandComplete: function( command, response, sshObj ) {
      if(response&&command){
        // trim the command of redundant output
        response = response.split('\n');
        response.shift();
        response.pop();
        response = _s.trim(response.join('\n') )+'\n';
      }
      if(cmdComplete) cmdComplete(command, response, server);
    },
    onEnd: function( sessionText, sshObj ) {
      allSessionText = sessionText;
    }
  };
  var SSH = new SSH2Shell(host);
  SSH.connect();

  SSH.on("close", function onError(err) {
    log.error(err)
    log.silly(allSessionText)
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

  server.username = server.username || server.userName || server.user;

  log.silly(pkg.name, '%s@%s:%s',server.username,server.host,server.port);

  log.verbose(pkg.name, '%s to %s',remoteFile,localPath);
  var conn = new Client();
  server.username = server.username || server.userName;
  conn.on('ready', function() {
    conn.sftp(function(err, sftp){
      if (err) throw err;
      sftp.fastGet(remoteFile, localPath, function(err){
        conn.end();
        then(err, server);
      });
    });
  }).connect(server);
};

/**
 *
 * @param server
 * @param localFile
 * @param remotePath
 * @param then
 */
SSH2Utils.prototype.putFile = function(server,localFile,remotePath, then){

  server.username = server.username || server.userName || server.user;

  throw 'Needs implementation';
};

/**
 * @param server
 * @param localPath
 * @param remotePath
 * @param then
 */
SSH2Utils.prototype.putDir = function(server,localPath,remotePath, then){

  server.username = server.username || server.userName || server.user;

  log.silly(pkg.name, '%s@%s:%s',server.username,server.host,server.port);

  log.verbose(pkg.name, 'from %s to %s',localPath,remotePath);
  var conn = new Client();
  conn.on('ready', function() {
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
            if(err) log.error(err);
            done();
          });
        });

        // create remote directories
        dirs.forEach(function(f){
          dirHandlers.push(function(done){
            var to = path.join(remotePath, f).replace(/[\\]/g,'/');
            log.verbose(pkg.name, 'mkdir %s', to);
            sftp.mkdir(to,function(err){
              if(err) log.error(err);
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
              log.verbose(pkg.name, 'put %s %s', from, to);
              sftp.fastPut(from, to, function(err){
                if(err) log.error(err);
                if(done) done();
              });
            })
          });

          // delete root remote directory if it exists
          log.verbose(pkg.name, 'rmdir %s', remotePath);
          sftp.rmdir(remotePath, function(err){
            if(err) log.error(err);
            // then push the scanned files and directories
            async.parallelLimit(dirHandlers, 4, function(){
              async.parallelLimit(filesHandlers, 4, function(){
                conn.end();
                if(then)then(err, server);
              });
            });
          });

        });

      });
    });
  }).connect(server);
};

/**
 *
 * @param server
 * @param remotePath
 * @param localPath
 * @param then
 */
SSH2Utils.prototype.getDir = function(server,remotePath,localPath, then){

  server.username = server.username || server.userName || server.user;

  throw 'Needs implementation';
};

module.exports = SSH2Utils;

