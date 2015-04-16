
var fs = require('fs');
var path = require('path');

var pwd = require('./pwd.json');
/*
 var pwd = {
   "localhost":{
     "user":"some",
     "pwd":"cred",
     "privateKey":"/absolute/path/to/.ssh/id_dsa"
   }
 };
*/

var SSH2Utils = require('../index.js');
var ssh = new SSH2Utils();
ssh.log.level = 'verbose';

// with password
(function(){
  var host = {
    'host':'127.0.0.1',
    port: 22,
    username: pwd.localhost.user,
    password: pwd.localhost.pwd
  };

  ssh.run(host,'ls -alh', function(err, stream, stderr, server, conn){
    if(err) return console.log(err)
    stream.on('data', function(d){
      console.log(d+'')
      console.log(server)
      stream.write('\nexit\n')
    });
    stderr.on('data', function(d){
      console.log(d+'')
    });
    stream.on('close', function(){
      conn.end();
    });
  });
})();

// with key
(function(){
  var host = {
    'host':'localhost',
    username: pwd.localhost.user,
    privateKey: fs.readFileSync(pwd.localhost.privateKey) // note that ~/ is not recognized
  };

  ssh.run(host,'ls -alh', function(err, stream, stderr, server, conn){
    if(err) return console.log(err)
    stream.on('data', function(d){
      console.log(d+'')
      console.log(server)
      stream.write('\nexit\n')
    });
    stderr.on('data', function(d){
      console.log(d+'')
    });
    stream.on('close', function(){
      conn.end();
    });
  });
})();
