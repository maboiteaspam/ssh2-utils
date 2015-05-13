
require('should');
var async = require('async');
var Vagrant = require('node-vagrant-bin');

var pwd = {};
if( process.env['TRAVIS'] )
  pwd = require('./test/travis-ssh.json');
else
  pwd = require('./test/vagrant-ssh.json');

var SSH2Utils = require('./index.js');
var ssh = new SSH2Utils();

var hostPwd = {
  'host':'127.0.0.1',
  port: pwd.localhostpwd.port || 22,
  username: pwd.localhostpwd.user,
  password: pwd.localhostpwd.pwd || undefined
};

var prepareBox = function(done){
  var cmds = [
    'rm -fr /home/vagrant/sample.txt',
    //'dd if=/dev/urandom of=/home/vagrant/sample.txt bs=1M count=1',
    'yes 123456789 | head -1677772 > /home/vagrant/sample.txt',
    'echo end >> /home/vagrant/sample.txt',
    'ls -alh /home/vagrant/sample.txt'
  ];
  ssh.exec(hostPwd, cmds, function(err,stdout,stderr,server,conn){
    if(err) console.error(err);
    conn.end();
    done();
  });
};
var readUsingAStream = function(done){
  ssh.streamReadFile(hostPwd, '/home/vagrant/sample.txt', function(err, stream,server,conn){
    if(err) console.error(err);
    stream.on('data', function(){});
    stream.on('close', function(){
      conn.end();
      done();
    });
  });
};
var readUsingExec = function(done){
  ssh.streamReadFileSudo(hostPwd, '/home/vagrant/sample.txt', function(err, stream,server,conn){
    if(err) console.error(err);
    stream.on('close', function(){
      conn.end();
      done();
    });
  });
};

var t0;
var t1;
var t2;
var t3;
async.series([
  function(next){
    var vagrant = new Vagrant();
    vagrant.isRunning(function(running){
      if(running===false){
        vagrant.up('precise64',function(err,booted){
          next();
        });
      }else{
        next();
      }
    });
  },
  function(next){
    t0 = Date.now();
    prepareBox(function(){
      t1 = Date.now();
      console.log('boot %s ms', t1-t0);
      next();
    });
  },
  function(next){
    readUsingAStream(function(){
      t2 = Date.now();
      console.log('readUsingAStream %s ms', t2-t1);
      next();
    });
  },
  function(next){
    readUsingExec(function(){
      t3 = Date.now();
      console.log('readUsingExec %s ms', t3-t2);
      next();
    });
  }
]);