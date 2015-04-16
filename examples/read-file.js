
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

var fixture = __dirname+'/fixture/';

// with password
(function(){
  var host = {
    'host':'127.0.0.1',
    port: 22,
    username: pwd.localhost.user,
    password: pwd.localhost.pwd
  };

  ssh.readFile(host,fixture+'/w2d.json',fixture+'/w2d.json2', function(err, server){
    if(err) return console.log(err)
    console.log(server)
  });
})();

// with key
(function(){
  var host = {
    'host':'localhost',
    username: pwd.localhost.user,
    privateKey: fs.readFileSync(pwd.localhost.privateKey) // note that ~/ is not recognized
  };

  ssh.readFile(host,fixture+'/w2d.json',fixture+'/w2d.json3', function(err, server){
    if(err) return console.log(err)
    console.log(server)
  });
})();
