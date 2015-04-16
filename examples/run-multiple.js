
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
    'host':'localhost',
    username: pwd.localhost.user,
    password: pwd.localhost.pwd
  };

  var cmds = [
    'echo hello',
    'ls',
    'time',
    "`All done!`"
  ];

  var onDone = function(sessionText, sshObj){
    console.log('All done')
  };

  var onCommandComplete = function(command, response, server){
    console.log((server.name||server.host)+' ' + require('moment')().format());
    console.log(command);
    if(response) console.log(response);
    console.log('');
  }

  ssh.runMultiple(host, cmds, onCommandComplete, onDone);

// or
// ssh.runMultiple(server, cmds, onDone);
})();



// with key
(function(){
  var host = {
    'host':'localhost',
    username: pwd.localhost.user,
    privateKey: fs.readFileSync(pwd.localhost.privateKey) // note that ~/ is not recognized
  };

  var cmds = [
    'echo hello',
    'ls',
    'time',
    "`All done!`"
  ];

  var onDone = function(sessionText, sshObj){
    console.log('All done')
  };

  var onCommandComplete = function(command, response, server){
    log.info((server.name||server.host)+' ' + require('moment')().format());
    console.log(command);
    if(response) console.log(response);
    console.log('');
  }

  ssh.runMultiple(host, cmds, onCommandComplete, onDone);
})();
