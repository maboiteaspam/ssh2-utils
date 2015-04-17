
var path = require('path');
var async = require('async');
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
  log.info('ssh', 'waiting for sudo');
  var hasChallenge = false;
  var tChallenge = setTimeout(function(){
      log.error('ssh', 'login in failed');
      if (then) then(true);
    },10000);
  var tChallengeS;
  stream.once('data', function(){
    tChallengeS = setTimeout(function(){
      if(!hasChallenge){
        clearTimeout(tChallenge)
        stream.removeListener('data', checkPwdInput);
        log.verbose('ssh', 'login in success');
        if (then) then(false);
      }
    },100);
  });
  var checkPwdInput = function(data){
    if(!hasChallenge && data.toString().match(/\[sudo\] password/) ){
      hasChallenge = true;
      log.info('ssh', 'login...');
      clearTimeout(tChallengeS);
      stream.write(pwd+'\n');
    } else if(hasChallenge){
      clearTimeout(tChallenge);
      if(data.toString().match(/Sorry, try again/) ){
        log.error('ssh', 'login in failed');
        if (then) then(true);
      }else{
        log.verbose('ssh', 'login in success');
        if (then) then(false);
      }
      hasChallenge = false;
    }
  };
  stream.on('end', function(){
    stream.removeListener('data', checkPwdInput);
  });
  stream.on('data', checkPwdInput);
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
 * @param server
 * @param cmd
 * @param done
 */
SSH2Utils.prototype.exec = function(server,cmd,done){

  var conn = new Client();

  server.username = server.username || server.userName; // it is acceptable in order to be config compliant with ssh2shell

  conn.on('ready', function() {

    var opts = {};
    if(cmd.match(/^sudo/) && ('password' in server) ) opts.pty = true;

    log.verbose(pkg.name, cmd);

    conn.exec(cmd, opts, function(err, stream) {

      if (err) throw err;

      var stderr = '';
      var stdout = '';
      stream.stderr.on('data', function(data){
        log.error('exec', 'STDERR: %s', data);
        stderr += data.toString();
      });
      stream.on('close', function(){
        conn.end();
      });
      stream.on('data', function(data){
        stdout += data.toString();
      });

      if( opts.pty ){
        sudoChallenge(stream, server['password'], function(success){
          stream.on('close', function(){
            if (done) done(success, stdout, stderr, server, conn);
          });
        });
      }else {
        stream.on('close', function(){
          if (done) done(false, stdout, stderr, server, conn);
        });
      }
    });
  }).connect(server);

  log.verbose(pkg.name, 'connecting %j', server);

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

  var conn = new Client();

  server.username = server.username || server.userName || server.user; // it is acceptable in order to be config compliant with ssh2shell

  conn.on('ready', function() {

    var opts = {};
    if(cmd.match(/^sudo/) && ('password' in server) ) opts.pty = true;

    log.verbose(pkg.name, cmd);

    conn.exec(cmd, opts, function(err, stream) {

      if (err) throw err;

      stream.stderr.on('data', function(data){
        log.error('exec', 'STDERR: %s', data);
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

      if( opts.pty ){
        sudoChallenge(stream, server['password'], function(success){
          stream.on('close', function(){
            process.removeListener('SIGINT', sigIntSent);
          });
          if (done) done(success, stream, stream.stderr, server, conn);
        });
      }else {
        stream.on('close', function(){
          process.removeListener('SIGINT', sigIntSent);
        });
        if (done) done(false, stream, stream.stderr, server, conn);
      }
    });
  }).connect(server);

  log.verbose(pkg.name, 'connecting');

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

  var host = {
    server:server,
    idleTimeOut:15000,
    connectedMessage:true,
    readyMessage:true,
    closedMessage:true,
    commands: [].concat(cmds), // very important to clone
    msg: {
      send: function( message ) {
        if(message!=true ){
          message = _s.trim(message);
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
      if(then) then(sessionText, server);
    }
  };
  var SSH = new SSH2Shell(host);
  SSH.connect();
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

  log.info(pkg.name, 'from %s to %s',localPath,remotePath);
  var conn = new Client();
  conn.on('ready', function() {
    conn.sftp(function(err, sftp){
      if (err) throw err;

      log.info(pkg.name, 'ready');
      var options = {
        cwd: localPath
      };

      // scan local directories
      glob( '**/', options, function (er, dirs) {

        var dirHandlers = [];

        // create root remote directory
        dirHandlers.push(function(done){
          log.info(pkg.name, 'mkdir %s', remotePath);
          sftp.mkdir(remotePath,function(err){
            if(err) log.error(err);
            done();
          });
        });

        // create remote directories
        dirs.forEach(function(f){
          dirHandlers.push(function(done){
            var to = path.join(remotePath, f).replace(/[\\]/g,'/');
            log.info(pkg.name, 'mkdir %s', to);
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
              log.info(pkg.name, 'put %s %s', from, to);
              sftp.fastPut(from, to, function(err){
                if(err) log.error(err);
                if(done) done();
              });
            })
          });

          // delete root remote directory if it exists
          log.info(pkg.name, 'rmdir %s', remotePath);
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

