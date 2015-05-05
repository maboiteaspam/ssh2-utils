# Global





* * *

### sudoChallenge(stream, pwd, then) 

sudo challenge completion over ssh

**Parameters**

**stream**: , sudo challenge completion over ssh

**pwd**: , sudo challenge completion over ssh

**then**: , sudo challenge completion over ssh



## Class: SSH2Utils


**getConnReady**:  
### SSH2Utils.connect(server, done) 

**Parameters**

**server**: 

**done**: 


### SSH2Utils.sudoExec(conn, server, cmd, done) 

**Parameters**

**conn**: 

**server**: 

**cmd**: 

**done**: 


### SSH2Utils.exec(server, cmd, done) 

Executes a command and return its output
 like child_process.exec.
non-interactive

also take care of
- close the connection once stream is closed
- manage sudo cmd
- log errors to output
- remote program termination with ctrl+C

**Parameters**

**server**: , Oject|Client

**cmd**: , Executes a command and return its output
 like child_process.exec.
non-interactive

also take care of
- close the connection once stream is closed
- manage sudo cmd
- log errors to output
- remote program termination with ctrl+C

**done**: , Executes a command and return its output
 like child_process.exec.
non-interactive

also take care of
- close the connection once stream is closed
- manage sudo cmd
- log errors to output
- remote program termination with ctrl+C


### SSH2Utils.run(server, cmd, done) 

Executes a command and return its stream,
 like of child_process.spawn.
interactive

also take care of
- close the connection once stream is closed
- manage sudo cmd
- log errors to output

**Parameters**

**server**: , Executes a command and return its stream,
 like of child_process.spawn.
interactive

also take care of
- close the connection once stream is closed
- manage sudo cmd
- log errors to output

**cmd**: , Executes a command and return its stream,
 like of child_process.spawn.
interactive

also take care of
- close the connection once stream is closed
- manage sudo cmd
- log errors to output

**done**: , Executes a command and return its stream,
 like of child_process.spawn.
interactive

also take care of
- close the connection once stream is closed
- manage sudo cmd
- log errors to output


### SSH2Utils.runMultiple(server, cmds, cmdComplete, then) 

Executes a set of multiple and sequential commands.
passive listener.

Take care of everything, su sudo ect

**Parameters**

**server**: , Executes a set of multiple and sequential commands.
passive listener.

Take care of everything, su sudo ect

**cmds**: , Executes a set of multiple and sequential commands.
passive listener.

Take care of everything, su sudo ect

**cmdComplete**: , Executes a set of multiple and sequential commands.
passive listener.

Take care of everything, su sudo ect

**then**: , Executes a set of multiple and sequential commands.
passive listener.

Take care of everything, su sudo ect


### SSH2Utils.readFile(server, remoteFile, localPath, then) 

**Parameters**

**server**: 

**remoteFile**: 

**localPath**: 

**then**: 


### SSH2Utils.putFile(server, localFile, remoteFile, then) 

**Parameters**

**server**: 

**localFile**: 

**remoteFile**: 

**then**: 


### SSH2Utils.writeFile(server, remoteFile, content, then) 

**Parameters**

**server**: 

**remoteFile**: 

**content**: 

**then**: 


### SSH2Utils.fileExists(server, remoteFile, then) 

**Parameters**

**server**: 

**remoteFile**: 

**then**: 


### SSH2Utils.rmdir(server, remotePath, then) 

**Parameters**

**server**: 

**remotePath**: 

**then**: 


### SSH2Utils.mkdir(server, remotePath, then) 

**Parameters**

**server**: 

**remotePath**: 

**then**: 


### SSH2Utils.putDir(server, localPath, remotePath, then) 

**Parameters**

**server**: 

**localPath**: 

**remotePath**: 

**then**: 


### SSH2Utils.getDir(server, remotePath, localPath, allDone) 

**Parameters**

**server**: 

**remotePath**: 

**localPath**: 

**allDone**: 




* * *










