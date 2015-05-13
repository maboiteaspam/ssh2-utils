# TOC
   - [ident](#ident)
   - [exec](#exec)
   - [exec multiple](#exec-multiple)
   - [run](#run)
   - [run multiple](#run-multiple)
   - [sftp ensureEmptyDir](#sftp-ensureemptydir)
   - [sftp fileExists](#sftp-fileexists)
   - [sftp putDir](#sftp-putdir)
   - [sftp readFile](#sftp-readfile)
   - [sftp getFile](#sftp-getfile)
   - [sftp mktemp](#sftp-mktemp)
   - [sftp ensureFileContains](#sftp-ensurefilecontains)
   - [sftp putFile](#sftp-putfile)
   - [sftp](#sftp)
   - [sftp failures](#sftp-failures)
   - [exec failures](#exec-failures)
<a name=""></a>
 
<a name="ident"></a>
# ident
exec can fail properly with password.

```js
var wrongHost = {
  'host':hostPwd.host,
  port: hostPwd.port,
  username: 'wrong',
  password: 'credentials'
};
ssh.exec(wrongHost, 'ls -alh', function(err, stdout, stderr){
  (!!err).should.be.true;
  (stdout).should.be.empty;
  (err.message).should.match(/failed/);
  (stderr).should.match(/failed/);
  done();
});
```

run can fail properly with private key.

```js
var wrongHost = {
  'host':hostKey.host,
  port: hostKey.port,
  username: 'wrong',
  privateKey: hostKey.privateKey
};
ssh.run(wrongHost, 'ls -alh', function(err, stdout, stderr){
  (!!err).should.be.true;
  (stdout===null).should.be.true;
  (err.message).should.match(/failed/);
  (stderr).should.match(/failed/);
  done();
});
```

<a name="exec"></a>
# exec
can execute command.

```js
ssh.exec(hostPwd,'ls -alh /var/log/', function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  conn.end();
  done();
});
```

can execute command with private key.

```js
ssh.exec(hostKey,'ls -alh /var/log/', function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  conn.end();
  done()
});
```

can execute sudo command.

```js
this.timeout(50000);
ssh.exec(hostPwd,'sudo ls -alh', function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(new RegExp(server.username));
  stderr.should.be.empty;
  // re use connection
  ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
    (!!err).should.be.false;
    stdout.should.match(new RegExp(server.username));
    stderr.should.be.empty;
    conn.end();
    done();
  });
});
```

can connect with private key and execute sudo command.

```js
this.timeout(50000);
ssh.exec(hostKey,'sudo ls -alh', function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(new RegExp(server.username));
  stderr.should.be.empty;
  // re use connection
  ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
    (!!err).should.be.false;
    stdout.should.match(new RegExp(server.username));
    stderr.should.be.empty;
    conn.end();
    done();
  });
});
```

can fail properly.

```js
ssh.exec(hostPwd,'ls -alh /nofile', function(err, stdout, stderr, server, conn){
  (!!err).should.be.true;
  stderr.should.match(/No such file or directory/);
  err.message.should.match(/No such file or directory/);
  stdout.should.be.empty;
  conn.end();
  done();
});
```

can fail properly.

```js
ssh.exec(hostPwd, 'dsscdc', function(err, stdout, stderr, server, conn){
  (!!err).should.be.true;
  stderr.should.match(/command not found/);
  err.message.should.match(/command not found/);
  stdout.should.be.empty;
  conn.end();
  done();
});
```

<a name="exec-multiple"></a>
# exec multiple
can execute multiple commands.

```js
ssh.exec(hostPwd,['ls', 'ls -alh /var/log/'], function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  conn.end();
  done()
});
```

can execute multiple sudo commands.

```js
ssh.exec(hostPwd,['sudo ls', 'sudo ls -alh /var/log/'], function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  conn.end();
  done()
});
```

can capture multiple outputs.

```js
var doneCnt = 0;
var doneEach = function(){
  doneCnt++;
};
ssh.exec(hostPwd,['ls', 'ls -alh /var/log/'], doneEach, function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  doneCnt.should.eql(2);
  conn.end();
  done()
});
```

can capture multiple sudo outputs.

```js
var doneCnt = 0;
var doneEach = function(){
  doneCnt++;
};
ssh.exec(hostPwd,['sudo ls', 'sudo ls -alh /var/log/'], doneEach, function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  doneCnt.should.eql(2);
  conn.end();
  done()
});
```

can fail properly.

```js
ssh.exec(hostPwd, ['ls', 'ls -alh /nofile', 'ls -alh /var/log/'], function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.match(/No such file or directory/);
  conn.end();
  done();
});
```

can fail properly.

```js
var doneCnt = 0;
var failedCnt = 0;
var doneEach = function(err){
  doneCnt++;
  if(err) failedCnt++;
};
ssh.exec(hostPwd, ['ls', 'ls -alh /nofile', 'ls -alh /var/log/'], doneEach, function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.match(/No such file or directory/);
  doneCnt.should.eql(3);
  failedCnt.should.eql(1);
  conn.end();
  done();
});
```

can process commands in order.

```js
var cmds = [
  'echo "processed"',
  'echo "in"',
  'echo "order"'
];
ssh.exec(hostPwd, cmds, function(err, stdout, stderr, server, conn){
  (!!err).should.be.false;
  stdout.replace(/\n/g, ' ').should.eql('processed in order ');
  conn.end();
  done();
});
```

<a name="run"></a>
# run
can execute sudo command with password.

```js
var cmds = [
  //'sudo tail -f /var/log/{auth.log,secure}',
  'sudo tail -f /var/log/secure',
  'sudo tail -f /var/log/auth.log'
];
ssh.run(hostPwd, cmds, function(err, stdouts, stderrs, server, conn){
  (!!err).should.be.false;
  var stdout = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  setTimeout(function(){
    // re use connection
    ssh.run(conn,'ls -alh /var/log/', function(err2, stdout2){
      stdout2.on('data', function(data){
        data.toString().should.match(/root/);
        stdout.toString().should.match(/session/);
        conn.end();
        done();
      });
    });
  },500);
});
```

can execute sudo command with key.

```js
var cmds = [
  //'sudo tail -f /var/log/{auth.log,secure}',
  'sudo tail -f /var/log/secure',
  'sudo tail -f /var/log/auth.log'
];
ssh.run(hostKey, cmds, function(err, stdouts, stderrs, server, conn){
  (!!err).should.be.false;
  var stdout = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  setTimeout(function(){
    // re use connection
    ssh.run(conn,'ls -alh /var/log/', function(err2, stdout2){
      stdout2.on('data', _.debounce(function(data){
        data.toString().should.match(/root/);
        stdout.toString().should.match(/session/);
        conn.end();
        done();
      }, 500 ) );
    });
  },500);
});
```

can fail properly.

```js
ssh.run(hostPwd,'ls -alh /var/log/nofile', function(err, stdouts, stderrs, server, conn){
  var stdout = '';
  var stderr = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stderrs.on('data', function(data){
    stderr+=''+data;
  });
  stdouts.on('close', function(){
    stderr.should.match(/No such file or directory/)
    stdout.should.be.empty
    conn.end();
    done();
  });
  (!!err).should.be.false;
});
```

can fail properly.

```js
ssh.run(hostPwd, 'dsscdc', function(err, stdouts, stderrs, server, conn){
  var stdout = '';
  var stderr = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stderrs.on('data', function(data){
    stderr+=''+data;
  });
  stdouts.on('close', function(){
    stderr.should.match(/command not found/);
    stdout.should.be.empty;
    conn.end();
    done();
  });
  (!!err).should.be.false;
});
```

<a name="run-multiple"></a>
# run multiple
can execute multiple commands with sudo mixin using password.

```js
var cmds = [
  'sudo ls -alh /var/log/{auth.log,secure}',
  'sudo ls -alh /var/log/{auth.log,secure}',
  'ls -alh /var/log/'
];
ssh.run(hostPwd, cmds, function(err, stdouts, stderrs, server, conn){
  (!!err).should.be.false;
  var stdout = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stdouts.on('close', function(data){
    stdout.should.match(/root/);
    stdout.should.match(/total/);
    conn.end();
    done();
  });
});
```

can execute multiple commands with sudo mixin using key.

```js
var cmds = [
  'sudo ls -alh /var/log/{auth.log,secure}',
  'sudo ls -alh /var/log/{auth.log,secure}',
  'ls -alh /var/log/'
];
ssh.run(hostKey, cmds, function(err, stdouts, stderrs, server, conn){
  (!!err).should.be.false;
  var stdout = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stdouts.on('close', function(){
    stdout.should.match(/root/);
    stdout.should.match(/total/);
    conn.end();
    done();
  });
});
```

can fail properly.

```js
var cmds = [
  'sudo tail -f /var/log/secure',
  'sudo tail -f /var/log/auth.log',
  'ls -alh /var/log/',
  'ls -alh /var/log/nofile'
];
ssh.run(hostPwd, cmds, function(err, stdouts, stderrs, server, conn){
  (!!err).should.be.false;
  var stdout = '';
  var stderr = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stderrs.on('data', function(data){
    stderr+=''+data;
  });
  stdouts.on('close', function(){
    stderr.should.match(/No such file or directory/);
    stdout.should.match(/root/);
    stdout.should.match(/total/);
    conn.end();
    done();
  });
});
```

can fail properly.

```js
var cmds = [
  'sudo tail -f ~/.bashrc',
  'sudo tail -f /var/log/secure',
  'sudo tail -f /var/log/auth.log',
  'ls -alh /var/log/',
  'dsscdc'
];
ssh.run(hostPwd, cmds, function(err, stdouts, stderrs, server, conn){
  var stdout = '';
  var stderr = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stderrs.on('data', function(data){
    stderr+=''+data;
  });
  stdouts.on('close', function(){
    stderr.should.match(/command not found/);
    stdout.should.match(/(pam_unix|debug)/);
    stdout.should.match(/root/);
    stdout.should.match(/total/);
    conn.end();
    done();
  });
  (!!err).should.be.false;
});
```

<a name="sftp-ensureemptydir"></a>
# sftp ensureEmptyDir
can ensure a remote dir is empty and exists.

```js
ssh.ensureEmptyDir(hostPwd, '/home/vagrant/putdir-test', function(err, server, conn){
  ssh.fileExists(conn, '/home/vagrant/putdir-test', function(err2, exists){
    (!!err).should.be.false;
    (exists).should.be.true;
    conn.end();
    done();
  });
});
```

can ensure a remote dir is empty and exists via sudo.

```js
ssh.ensureEmptyDirSudo(hostPwd, '/tmp/empty-dir-sudo', function(err, server, conn){
  if(err) console.error(err);
  (!!err).should.be.false;
  ssh.fileExistsSudo(conn, '/tmp/empty-dir-sudo', function(err2, exists){
    if(err2) console.error(err2);
    (!!err2).should.be.false;
    (exists).should.be.true;
    conn.end();
    done();
  });
});
```

can fail properly.

```js
ssh.ensureEmptyDir(hostPwd, '/root/empty-dir-sudo-fail', function(err, server, conn){
  ssh.fileExists(conn, '/root/empty-dir-sudo-fail', function(err2, exists){
    (!!err).should.be.true;
    (exists).should.be.false;
    done();
  });
});
```

<a name="sftp-fileexists"></a>
# sftp fileExists
can ensure a remote path exists.

```js
ssh.ensureEmptyDir(hostPwd, '/home/vagrant/fileExists-test', function(err, server, conn){
  (!!err).should.be.false;
  ssh.fileExists(conn, '/home/vagrant/fileExists-test', function(err2, exists){
    (!!err2).should.be.false;
    (exists).should.be.true;
    conn.end();
    done();
  });
});
```

can ensure a remote path exists via sudo.

```js
ssh.ensureEmptyDirSudo(hostPwd, '/home/vagrant/fileExists-test', function(err, server, conn){
  (!!err).should.be.false;
  ssh.fileExistsSudo(conn, '/home/vagrant/fileExists-test', function(err2, exists){
    (!!err2).should.be.false;
    (exists).should.be.true;
    conn.end();
    done();
  });
});
```

can fail properly.

```js
ssh.fileExists(hostPwd, '/root/fileExists-fail', function(err, exists, server, conn){
  (!!err).should.be.true;
  (exists).should.be.false;
  conn.end();
  done();
});
```

<a name="sftp-putdir"></a>
# sftp putDir
can put a local dir to a remote.

```js
ssh.putDir(hostPwd, fixturePath, tmpRemotePath+'/putdir-test', function(err, server, conn){
  ssh.fileExists(conn, tmpRemotePath+'/putdir-test/temp'+t, function(err2, exists){
    (!!err).should.be.false;
    (exists).should.be.true;
    conn.end();
    done();
  });
});
```

can put a local dir to a remote via sudo.

```js
ssh.putDirSudo(hostPwd, fixturePath, '/root/putdir-test', function(err, server, conn){
  if(err) console.error(err);
  (!!err).should.be.false;
  ssh.fileExistsSudo(conn, '/root/putdir-test/temp'+t, function(err2, exists){
    if(err2) console.error(err2);
    (!!err2).should.be.false;
    (exists).should.be.true;
    conn.end();
    done();
  });
});
```

can fail properly.

```js
ssh.putDir(hostPwd, fixturePath, '/root/putdir-test-fail', function(err, server, conn){
  ssh.fileExists(conn, '/root/putdir-test-fail/temp'+t, function(err2, exists){
    (!!err).should.be.true;
    (exists).should.be.false;
    conn.end();
    done();
  });
});
```

<a name="sftp-readfile"></a>
# sftp readFile
can read a file from remote.

```js
ssh.readFile(hostPwd, '/home/vagrant/.bashrc', function(err, data){
  if(err) console.error(err);
  (!!err).should.be.false;
  data.should.match(/bashrc/);
  done();
});
```

can read a file from remote via sudo.

```js
ssh.readFileSudo(hostPwd, '/root/.bashrc', function(err, data){
  if(err) console.error(err);
  (!!err).should.be.false;
  data.should.match(/bashrc/);
  done();
});
```

can properly fail to read a file from remote.

```js
this.timeout(25000);
ssh.readFile(hostPwd, '~/NoSuchFile', function(err, data){
  if(err) console.error(err);
  (!!err).should.be.true;
  err.code.should.eql(2);
  err.message.should.match(/No such file/);
  done();
});
```

<a name="sftp-getfile"></a>
# sftp getFile
can download a file.

```js
ssh.writeFile(hostPwd, tmpRemotePath+'/remote'+t, t, function(err, server, conn){
  (!!err).should.be.false;
  ssh.getFile(conn, tmpRemotePath+'/remote'+t, fixturePath + 'local'+t, function(err){
    (!!err).should.be.false;
    fs.readFileSync(fixturePath + 'local'+t,'utf-8').should.eql(''+t);
    conn.end();
    done();
  });
});
```

<a name="sftp-mktemp"></a>
# sftp mktemp
can safely create a remote temporary directory.

```js
ssh.mktemp(hostPwd, 'some', function(err, tempPath, server, conn){
  ssh.writeFile(conn, tempPath+'/test', t, function(){
    ssh.readFile(conn, tempPath+'/test', function(err, data){
      (!!err).should.be.false;
      data.should.eql(''+t);
      conn.end();
      done();
    });
  });
});
```

<a name="sftp-ensurefilecontains"></a>
# sftp ensureFileContains
can ensure a file contains a certain piece of text.

```js
ssh.writeFile(hostPwd, tmpRemotePath+'/remote5'+t, t, function(err){
  (!!err).should.be.false;
  ssh.ensureFileContains(hostPwd, tmpRemotePath+'/remote5'+t, t, function(contains, err){
    (!!err).should.be.false;
    (contains).should.be.true;
    done(err);
  });
});
```

can ensure a file contains a certain piece of text via sudo.

```js
t++;
fs.writeFileSync(fixturePath + 'local'+t, t);
ssh.putFileSudo(hostPwd, fixturePath + 'local'+t, '/root/remote8'+t, function(err){
  (!!err).should.be.false;
  ssh.ensureFileContainsSudo(hostPwd, '/root/remote8'+t, t, function(contains, err){
    (!!err).should.be.false;
    (contains).should.be.true;
    done(err);
  });
});
```

<a name="sftp-putfile"></a>
# sftp putFile
can put file on remote.

```js
fs.writeFileSync(fixturePath + 'local'+t, t);
ssh.putFile(hostPwd, fixturePath + 'local'+t, tmpRemotePath+'/remote'+t, function(err, server, conn){
  (!!err).should.be.false;
  ssh.ensureFileContains(conn, tmpRemotePath+'/remote'+t, t, function(contains, err){
    (!!err).should.be.false;
    (contains).should.be.true;
    conn.end();
    done();
  });
});
```

can put file on remote via sudo.

```js
t++;
fs.writeFileSync(fixturePath + 'local'+t, t);
ssh.putFileSudo(hostPwd, fixturePath + 'local'+t, '/root/some'+t, function(err){
  (!!err).should.be.false;
  ssh.ensureFileContainsSudo(hostPwd, '/root/some'+t, t, function(contains, err){
    (!!err).should.be.false;
    (contains).should.be.true;
    done(err);
  });
});
```

<a name="sftp"></a>
# sftp
can test file exists.

```js
ssh.fileExists(hostPwd, '/home/vagrant/.bashrc', function(err, exists){
  (!!err).should.be.false;
  (exists).should.be.true;
  done();
});
```

can write a file content.

```js
ssh.writeFile(hostPwd, tmpRemotePath+'/remote2'+t, t, function(err,server,conn){
  (!!err).should.be.false;
  ssh.fileExists(conn, tmpRemotePath+'/remote2'+t, function(err){
    (!!err).should.be.false;
    ssh.getFile(conn, tmpRemotePath+'/remote2'+t, fixturePath + 'local2'+t, function(err){
      (!!err).should.be.false;
      fs.readFileSync(fixturePath + 'local2'+t,'utf-8').should.eql(''+t);
      conn.end();
      done();
    });
  });
});
```

can create a directory.

```js
ssh.mkdir(hostPwd, '/home/vagrant/examples', function(err,server,conn){
  (!!err).should.be.false;
  ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err){
    (!!err).should.be.false;
    conn.end();
    done();
  });
});
```

can delete a directory.

```js
ssh.rmdir(hostPwd, '/home/vagrant/examples', function(err, server, conn){
  (!!err).should.be.false;
  ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err, exists){
    (!!err).should.be.true;
    (exists).should.be.false;
    (err.message).should.match(/No such file/i);
    conn.end();
    done();
  });
});
```

<a name="sftp-failures"></a>
# sftp failures
can fail correctly when it can t test if a file.

```js
ssh.fileExists(hostPwd, '/root/.bashrc', function(err, exists, server, conn){
  (!!err).should.be.true;
  err.code.should.eql(3);
  err.message.should.match(/Permission denied/);
  conn.end();
  done();
});
```

can fail correctly when it can t write a file.

```js
ssh.writeFile(hostPwd, '/root/cannot', 'some', function(err){
  (!!err).should.be.true;
  err.code.should.eql(3);
  err.message.should.match(/Permission denied/);
  done();
});
```

can fail correctly when it can t mkdir.

```js
ssh.mkdir(hostPwd, '/root/cannot', function(err){
  (!!err).should.be.true;
  err.code.should.eql(3);
  err.message.should.match(/Permission denied/);
  done();
});
```

can fail correctly when it can t rmdir.

```js
ssh.exec(hostPwd, 'sudo mkdir -p /root/some', function(err,stdout,sterr,sever,conn){
  ssh.rmdir(conn, '/root/some', function(err){
    (!!err).should.be.true;
    err.code.should.eql(3);
    err.message.should.match(/Permission denied/);
    conn.end();
    done();
  });
});
```

<a name="exec-failures"></a>
# exec failures
can fail correctly when it can t execute a command.

```js
ssh.exec(hostPwd, 'echo some >> /root/cannot', function(err,stdout,stderr, server, conn){
  (!!err).should.be.true;
  err.message.should.match(/Permission denied/);
  conn.end();
  done();
});
```

