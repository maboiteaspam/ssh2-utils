# SSH2Utils

A library to ease use of excellent modules ssh2 and ssh2shell.

Provide a set of methods to exec/run/getFile/putFile/getDir/putDir.

# Install

```npm i ssh2-utils --save```

# Usage

```js
var SSH2Utils = require('');

var server = {};

var ssh = new SSH2Utils();

// exec on remote
ssh.exec(server, 'ls', function(err,stdout,stderr){
});

// stream and interact
ssh.run(server, 'sudo tail -f /var/log/some', function(err,stream,stderr){
    stream.end('\nexit\n);
});

var cmds = [
    'echo hello',
    'ls',
    'time',
];

var onDone = function(sessionText, sshObj){
}

var onCommandComplete = function(command, response, server){
    log.info((server.name||server.host)+' ' + require('moment')().format());
    console.log(command);
    if(response) console.log(response);
    console.log('');
}

ssh.runMultiple(server, cmds, onCommandComplete, onDone);

// or 
// ssh.runMultiple(server, cmds, onDone);

ssh.readFile(server,'/tmp/from_some_remote','/tmp/to_some_local', function(err){
});

ssh.putDir(server,'/tmp/to_some_remote','/tmp/from_some_local', function(err){
});

```

# Status

In development. It needs some tests. It misses putFile and readDir implementations.