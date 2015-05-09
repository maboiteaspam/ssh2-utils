# Global





* * *

### returnOrThrow(then, err) 

**Parameters**

**then**: 

**err**: 



## Class: ServerCredentials
Server credentials information
It can use password or key
to login, or run sudo command
transparently

### ServerCredentials.sudoChallenge(stream, pwd, then) 

sudo challenge completion over ssh

If the login success, hasLogin is true

**Parameters**

**stream**: , Stream

**pwd**: , string

**then**: , callback(bool hasLogin)



## Class: SSH2Utils


**getConnReady**:  
### SSH2Utils.connect(server, done) 

opens ssh connection

**Parameters**

**server**: , ServerCredentials

**done**: , (err, ssh2.Client conn)


### SSH2Utils.sudoExec(conn, server, cmd, done) 

Execute a command and returns asap

**Parameters**

**conn**: , ssh2.Client

**server**: , ServerCredentials

**cmd**: , String

**done**: , callback(err, ssh2._Channel_ stream)


### SSH2Utils.execOne(server, cmd, done) 

Executes a command and return its output
 like child_process.exec.
non-interactive

also take care of
- manage sudo cmd
- log errors to output
- remote program termination with ctrl+C

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**cmd**: , String

**done**: , callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.exec(server, cmd, doneEach, done) 

Executes a command and return its output
 like child_process.exec.
non-interactive

also take care of
- manage sudo cmd
- log errors to output
- remote program termination with ctrl+C

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**cmd**: , String

**doneEach**: , callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)

**done**: , callback(bool err, String stdout, String stderr, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.run(server, cmd, done) 

Executes a command and return its stream,
 like of child_process.spawn.
interactive

also take care of
- manage sudo cmd
- log errors to output

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**cmd**: , String

**done**: , callback(bool err, Stream stdout, Stream stderr, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.runMultiple(server, cmds, cmdComplete, then) 

Executes a set of multiple and sequential commands.
passive listener.

Take care of everything, su sudo ect

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**cmds**: , [String]

**cmdComplete**: , callback(String command, String response, ServerCredentials server)

**then**: , callback(err, String allSessionText, ServerCredentials server)


### SSH2Utils.readFile(server, remoteFile, localPath, then) 

Downloads a file to the local

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remoteFile**: , String

**localPath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.ensureFileContains(server, remoteFile, contain, then) 

Ensure a remote file contains a certain text piece of text

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remoteFile**: , String

**contain**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.putFile(server, localFile, remoteFile, then) 

Uploads a file on the remote remote

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**localFile**: , String

**remoteFile**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.writeFile(server, remoteFile, content, then) 

Writes content to a remote file

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remoteFile**: , String

**content**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.writeFileSudo(server, remoteFile, content, then) 

Writes content to a remote file

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remoteFile**: , String

**content**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.fileExists(server, remoteFile, then) 

Tells if a file exists on remote
by trying to open handle on it.

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remoteFile**: , String

**then**: , callback(err, exists, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.fileExistsSudo(server, remoteFile, then) 

Tells if a file exists on remote
by trying to open handle on it.

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remoteFile**: , String

**then**: , callback(err, exists, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.rmdir(server, remotePath, then) 

Deletes a file or directory
rm -fr /some/path

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.rmdirSudo(server, remotePath, then) 

Deletes a file or directory
sudo rm -fr /some/path

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.mkdir(server, remotePath, then) 

Creates a remote directory

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.mkdirSudo(server, remotePath, then) 

Creates a remote directory

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.ensureEmptyDir(server, remotePath, then) 

Ensure a remote directory exists and is empty

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.ensureEmptyDirSudo(server, remotePath, then) 

Ensure a remote directory exists and is empty

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.ensureOwnership(server, remotePath, then) 

Ensure a file belongs to connected user
by sudo chmod -R /path

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.putDir(server, localPath, remotePath, then) 

Uploads a local directory to the remote.
Partly in series, partly parallel.
Proceed such
sudo rm -fr /remotePath
sudo mkdir -p /remotePath
recursive sftp mkdir
recursive sftp put

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**localPath**: , String

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.putDirSudo(server, localPath, remotePath, then) 

Uploads a local directory to the remote.
Partly in series, partly parallel.
Proceed such
sudo rm -fr /remotePath
sudo mkdir -p /remotePath
recursive sftp mkdir
recursive sftp put

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**localPath**: , String

**remotePath**: , String

**then**: , callback(err, ServerCredentials server, ssh2.Client conn)


### SSH2Utils.getDir(server, remotePath, localPath, allDone) 

Downloads a remote directory to the local.
remote traverse directories over sftp.
then get files in parallel

**Parameters**

**server**: , ServerCredentials|ssh2.Client

**remotePath**: , String

**localPath**: , String

**allDone**: , callback(err, ServerCredentials server, ssh2.Client conn)




* * *










