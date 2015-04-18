# SSH2Utils [![Build Status](https://travis-ci.org/maboiteaspam/ssh2-utils.svg?branch=master)](https://travis-ci.org/maboiteaspam/ssh2-utils)

A library to ease use of excellent modules ssh2 and ssh2shell.

Provide a set of methods to exec/run/getFile/putFile/getDir/putDir.

---------------------------------------


# Install

```npm i ssh2-utils --save```

---------------------------------------


### API

* [`SSH2Utils`]()
    * [`exec`](#exec)
    * [`run`](#run)
    * [`runMultiple`](#runMultiple)
    * [`readFile`](#readFile)
    * [`putDir`](#putDir)
    * [`readDir`](#readDir)
    * [`putFile`](#putFile)
    

<a name="SSH2Utils" />
### new SSH2Utils()

SSH2Utils constructor.

__Arguments__


__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
```



<a name="exec" />
### SSH2Utils.exec(server, cmd, callback)

Execute a command on remote server and return its output.

__Arguments__

* `server` - An object of ssh server credentials.
* `cmd` - A command line to execute on remote.
* `callback(err,stdout,stderr,server,conn)` - A callback called on command line completion. 
    * `err` isa Boolean.
    * `stdout` `stderr` are String.
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
    
    ssh.exec(server, 'ls', function(err,stdout,stderr){
        if(err) console.log(err);
        console.log(stdout);
        console.log(stderr);
    });
```


<a name="run" />
### SSH2Utils.run(server, cmd, callback)

Execute a command on remote server and return its streams.

__Arguments__

* `server` - An object of ssh server credentials.
* `cmd` - A command line to execute on remote.
* `callback(err,stdout,stderr,server,conn)` - A callback called on command line sent. 
    * `err` isa Boolean.
    * `stdout` `stderr` are Streams.
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
    
    ssh.run(server, ['ls','time'], function(err,stdout,stderr,server,conn){
        if(err) console.log(err);
        stdout.on('data', function(){
            console.log(''+data);
        });
        stderr.on('data', function(){
            console.log(''+data);
        });
        stdout.on('close',function(){
            conn.end();
        });
    });
```


<a name="runMultiple" />
### SSH2Utils.runMultiple(server, cmds, onCmdCplt, onDone)
##### SSH2Utils.runMultiple(server, cmds, onDone)

Execute a series of command on remote server and returns their output.

__Arguments__

* `server` - An object of ssh server credentials.
* `cmds` - An array of commands line to execute on remote.
* `onCmdCplt(command, response, server)` - A callback called on command line completion. 
    * `command` the completed command line.
    * `response` the completed command line response.
    * `server` An ssh server credentials object.
* `onDone(sessionText, sshObj)` - A callback called on session completion. 
    * `err` an Error.
    * `sessionText` a String.
    * `sshObj` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
    
    ssh.runMultiple(server, ['ls','time'], function(sessionText, sshObj){
        console.log(sessionText);
    });
```


<a name="readFile" />
### SSH2Utils.readFile(server, remoteFile, localPath, callback)

Download a file from remote to local.

__Arguments__

* `server` - An object of ssh server credentials.
* `remoteFile` - A remote file path to read.
* `localPath` - A local file path to write.
* `callback(err)` - A callback called on command line completion. 
    * `err` is an Error.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.readFile(server,'/tmp/from_some_remote','/tmp/to_some_local', function(err){
        if(err) console.log(err);
    });
```


<a name="putDir" />
### SSH2Utils.putDir(server, localPath, remoteFile, callback)

Put a local directory contents to a remote path.

__Arguments__

* `server` - An object of ssh server credentials.
* `localPath` - A local file path to write.
* `remoteFile` - A remote file path to read.
* `callback(err)` - A callback called on command line completion. 
    * `err` is an Error.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.putDir(server,'/tmp/from_some_local','/tmp/to_some_remote', function(err){
        if(err) console.log(err);
    });
```


---------------------------------------

# Suggestions

On linux you may want to edit `/etc/ssh/ssh_config` and append 
```
Host 127.0.0.1
   CheckHostIP no
   StrictHostKeyChecking no
   UserKnownHostsFile=/dev/null
```

This will help to have multiple vagrant box installed on the same machine.

---------------------------------------

# Status

In development. It needs some tests. It misses putFile and readDir implementations.