# SSH2Utils [![Build Status](https://travis-ci.org/maboiteaspam/ssh2-utils.svg?branch=master)](https://travis-ci.org/maboiteaspam/ssh2-utils)

A library to ease use of excellent modules ssh2.

Provide a set of methods to exec/run/getFile/putFile/getDir/putDir.

---------------------------------------


# Install

```npm i ssh2-utils --save```

---------------------------------------


# Documentation

Automatic source code documentation generation 

is supported by jsdoc at https://maboiteaspam.github.io/ssh2-utils/docs/

Automatic tests documentation  generation 

is support by mocha https://github.com/maboiteaspam/ssh2-utils/tree/gh-pages/mocha-tests.md


### API

* [`SSH2Utils`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html)
    * [`open`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#open)
    * [`exec`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#exec)
    * [`run`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#run)
    * [`runMultiple`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#runMultiple)
    * [`mktemp`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#mktemp)
    * [`readFile`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#readFile)
    * [`readFileSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#readFileSudo)
    * [`getFile`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#getFile)
    * [`putDir`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#putDir)
    * [`putDirSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#putDirSudo)
    * [`readDir`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#readDir)
    * [`putFile`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#putFile)
    * [`putFileSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#putFileSudo)
    * [`mkdir`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#mkdir)
    * [`mkdirSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#mkdirSudo)
    * [`rmdir`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#rmdir)
    * [`rmdirSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#rmdirSudo)
    * [`writeFile`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#writeFile)
    * [`writeFileSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#writeFileSudo)
    * [`getDir`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#getDir)
    * [`fileExists`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#fileExists)
    * [`fileExistsSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#fileExistsSudo)
    * [`ensureFileContains`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#ensureFileContains)
    * [`ensureFileContainsSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#ensureFileContainsSudo)
    * [`ensureEmptyDir`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#ensureEmptyDir)
    * [`ensureEmptyDirSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#ensureEmptyDirSudo)
    * [`ensureOwnership`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#ensureOwnership)
    * [`streamReadFile`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#streamReadFile)
    * [`streamReadFileSudo`](http://maboiteaspam.github.io/ssh2-utils/docs/SSH2Utils.html#streamReadFileSudo)

---------------------------------------

### Examples

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


<a name="getFile" />
### SSH2Utils.getFile(server, remoteFile, localPath, callback)

Download a file from remote to local.

__Arguments__

* `server` - An object of ssh server credentials.
* `remoteFile` - A remote file path to read.
* `localPath` - A local file path to write.
* `callback(err)` - A callback called on command line completion. 
    * `err` is an Error.
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.getFile(server,'/tmp/from_some_remote','/tmp/to_some_local', function(err){
        if(err) console.log(err);
    });
```


<a name="putFile" />
### SSH2Utils.putFile(server, localFile, remoteFile, callback)

Put a file from local to remote

__Arguments__

* `server` - An object of ssh server credentials.
* `localFile` - A local file path to write.
* `remoteFile` - A remote file path to read.
* `callback(err)` - A callback called on command line completion. 
    * `err` is an Error.
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.putFile(server,'/tmp/to_some_local','/tmp/from_some_remote', function(err){
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
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.putDir(server,'/tmp/from_some_local','/tmp/to_some_remote', function(err){
        if(err) console.log(err);
    });
```


<a name="mkdir" />
### SSH2Utils.mkdir(server, remotePath, callback)

Create a directory at remote path.

__Arguments__

* `server` - An object of ssh server credentials.
* `remotePath` - A remote path to create.
* `callback(err)` - A callback called on command line completion. 
    * `err` is an Error.
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.mkdir(server,'/tmp/to_some_remote', function(err){
        if(err) console.log(err);
    });
```


<a name="rmdir" />
### SSH2Utils.rmdir(server, remotePath, callback)

Deletes a directory at remote path.

Effectively performs ``rm -fr remotePath``.

__Arguments__

* `server` - An object of ssh server credentials.
* `remotePath` - A remote path to delete.
* `callback(err)` - A callback called on command line completion. 
    * `err` is an Error.
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.rmdir(server,'/tmp/to_some_remote', function(err){
        if(err) console.log(err);
    });
```


<a name="fileExists" />
### SSH2Utils.fileExists(server, remotePath, callback)

Tests a path on remote.

__Arguments__

* `server` - An object of ssh server credentials.
* `remotePath` - A remote path to tests.
* `callback(err)` - A callback called on command line completion. 
    * `err` is an Error if file does not exists.
    * `server` An ssh server credentials object.
    * `conn` An ssh Client object.

__Examples__

```js
    var SSH2Utils = require('ssh2-utils');
    var ssh = new SSH2Utils();
    
    var server = {host: "localhost", username:"user", password:"pwd" };
        
    ssh.fileExists(server,'/tmp/to_some_remote', function(err){
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

------

On fedora you may want to create `/etc/polkit-1/rules.d/10.virt.rules` and add
```
polkit.addRule(function(action, subject) {
  polkit.log("action=" + action);
  polkit.log("subject=" + subject);
  var now = new Date();
  polkit.log("now=" + now)
  if ((action.id == "org.libvirt.unix.manage"
        || action.id == "org.libvirt.unix.monitor")
        
        && subject.isInGroup("~~your username group~~") // <--- change HERE
        
      ) {
    return polkit.Result.YES;
  }
  return null;
});
```

This will help to prevent the system from asking the password.

---------------------------------------

# Status

In development. It needs some tests. some more methods implementation.