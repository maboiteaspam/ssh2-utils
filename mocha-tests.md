running machine precise64
null
running machine precise64
# TOC
   - [ident](#ident)
   - [exec](#exec)
   - [exec multiple](#exec-multiple)
   - [run](#run)
   - [run multiple](#run-multiple)
   - [sftp ensureEmptyDir](#sftp-ensureemptydir)
   - [sftp fileExists](#sftp-fileexists)
   - [sftp putDir](#sftp-putdir)
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
ssh.exec(wrongHost, 'ls -alh', function(err, stdout, stderr, server){
  (!!err).should.be.true;
  (stdout===null).should.be.true;
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
ssh.run(wrongHost, 'ls -alh', function(err, stdout, stderr, server){
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
ssh.exec(hostPwd,'ls -alh /var/log/', function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  done()
});
```

can execute command with private key.

```js
ssh.exec(hostKey,'ls -alh /var/log/', function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  done()
});
```

can execute sudo command.

```js
this.timeout(50000);
ssh.exec(hostPwd,'sudo ls -alh', function(err, stdout, stderr, server,conn){
  (!!err).should.be.false;
  stdout.should.match(new RegExp(server.username));
  stderr.should.be.empty;
  // re use connection
  ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
    (!!err).should.be.false;
    stdout.should.match(new RegExp(server.username));
    stderr.should.be.empty;
    done();
  });
});
```

can connect with private key and execute sudo command.

```js
this.timeout(50000);
ssh.exec(hostKey,'sudo ls -alh', function(err, stdout, stderr, server,conn){
  (!!err).should.be.false;
  stdout.should.match(new RegExp(server.username));
  stderr.should.be.empty;
  // re use connection
  ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
    (!!err).should.be.false;
    stdout.should.match(new RegExp(server.username));
    stderr.should.be.empty;
    done();
  });
});
```

can fail properly.

```js
ssh.exec(hostPwd,'ls -alh /nofile', function(err, stdout, stderr, server){
  (!!err).should.be.true;
  stderr.should.match(/No such file or directory/);
  err.message.should.match(/No such file or directory/);
  stdout.should.be.empty;
  done();
});
```

can fail properly.

```js
ssh.exec(hostPwd, 'dsscdc', function(err, stdout, stderr, server){
  (!!err).should.be.true;
  stderr.should.match(/command not found/);
  err.message.should.match(/command not found/);
  stdout.should.be.empty;
  done();
});
```

<a name="exec-multiple"></a>
# exec multiple
can execute multiple commands.

```js
ssh.exec(hostPwd,['ls', 'ls -alh /var/log/'], function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  done()
});
```

can execute multiple sudo commands.

```js
ssh.exec(hostPwd,['sudo ls', 'sudo ls -alh /var/log/'], function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  done()
});
```

can capture multiple outputs.

```js
var doneCnt = 0;
var doneEach = function(){
  doneCnt++;
};
ssh.exec(hostPwd,['ls', 'ls -alh /var/log/'], doneEach, function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  doneCnt.should.eql(2);
  done()
});
```

can capture multiple sudo outputs.

```js
var doneCnt = 0;
var doneEach = function(){
  doneCnt++;
};
ssh.exec(hostPwd,['sudo ls', 'sudo ls -alh /var/log/'], doneEach, function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  doneCnt.should.eql(2);
  done()
});
```

can fail properly while executing multiple commands.

```js
ssh.exec(hostPwd, ['ls', 'ls -alh /nofile', 'ls -alh /var/log/'], function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  done();
});
```

can fail properly while executing multiple commands.

```js
var doneCnt = 0;
var failedCnt = 0;
var doneEach = function(err){
  doneCnt++;
  if(err) failedCnt++;
};
ssh.exec(hostPwd, ['ls', 'ls -alh /nofile', 'ls -alh /var/log/'], doneEach, function(err, stdout, stderr, server){
  (!!err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  doneCnt.should.eql(3);
  failedCnt.should.eql(1);
  done();
});
```

<a name="run"></a>
# run
can run sudo command with password.

```js
ssh.run(hostPwd,'sudo tail -f /var/log/{auth.log,secure}', function(err, stdouts, stderrs, server, conn){
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
      },500));
    });
  },500);
});
```

can connect with private key and run sudo command with password.

```js
ssh.run(hostKey,'sudo tail -f /var/log/{auth.log,secure}', function(err, stdouts, stderrs, server, conn){
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

run can fail properly.

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

run can fail properly.

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
can multiple run sudo command with password.

```js
var cmds = [
  'sudo ls -alh /var/log/auth.log',
  'sudo ls -alh /var/log/secure',
  'ls -alh /var/log/'
];
ssh.run(hostPwd, cmds, function(err, stdouts, stderrs, server, conn){
  (!!err).should.be.false;
  var stdout = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stdouts.on('data', _.debounce(function(data){
    data.toString().should.match(/root/);
    stdout.toString().should.match(/total/);
    conn.end();
    done();
  }, 1000));
});
```

can run multiple sudo command with password.

```js
var cmds = [
  'sudo ls -alh /var/log/auth.log',
  'sudo ls -alh /var/log/secure',
  'ls -alh /var/log/'
];
ssh.run(hostKey, cmds, function(err, stdouts, stderrs, server, conn){
  (!!err).should.be.false;
  var stdout = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  stdouts.on('data', _.debounce(function(data){
    data.toString().should.match(/root/);
    stdout.toString().should.match(/total/);
    conn.end();
    done();
  }, 1000 ) );
});
```

can run multiple sudo command and fail properly.

```js
var cmds = [
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
    stdout.should.be.empty;
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
    done();
  });
});
```

can ensure a remote dir is empty and exists via sudo.

```js
ssh.ensureEmptyDirSudo(hostPwd, '/tmp/empty-dir-sudo', function(err, server, conn){
  ssh.fileExistsSudo(conn, '/tmp/empty-dir-sudo', function(err2, exists){
    (!!err).should.be.false;
    (exists).should.be.true;
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
    done();
  });
});
```

can fail properly.

```js
ssh.fileExists(hostPwd, '/root/fileExists-fail', function(err, exists){
  (!!err).should.be.true;
  (exists).should.be.false;
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
    done();
  });
});
```

can put a local dir to a remote via sudo.

```js
ssh.putDirSudo(hostPwd, fixturePath, '/root/putdir-test', function(err, server, conn){
  (!!err).should.be.false;
  ssh.fileExistsSudo(conn, '/root/putdir-test/temp'+t, function(err2, exists){
    console.log(err2);
    (!!err2).should.be.false;
    (exists).should.be.true;
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
    done();
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

can write a file.

```js
fs.writeFileSync(fixturePath + 'local'+t, t);
ssh.putFile(hostPwd, fixturePath + 'local'+t, tmpRemotePath+'/remote'+t, function(err, server, conn){
  (!!err).should.be.false;
  ssh.fileExists(conn, tmpRemotePath+'/remote'+t, function(err, exists){
    (!!err).should.be.false;
    (exists).should.be.true;
    done();
  });
});
```

can download a file.

```js
ssh.readFile(hostPwd, tmpRemotePath+'/remote'+t, fixturePath + 'local'+t, function(err){
  (!!err).should.be.false;
  fs.readFileSync(fixturePath + 'local'+t,'utf-8').should.eql(''+t);
  done();
});
```

can write a file content.

```js
ssh.writeFile(hostPwd, tmpRemotePath+'/remote2'+t, t, function(err){
  (!!err).should.be.false;
  ssh.fileExists(hostPwd, tmpRemotePath+'/remote2'+t, function(err){
    (!!err).should.be.false;
    ssh.readFile(hostPwd, tmpRemotePath+'/remote2'+t, fixturePath + 'local2'+t, function(err){
      (!!err).should.be.false;
      fs.readFileSync(fixturePath + 'local2'+t,'utf-8').should.eql(''+t);
      done();
    });
  });
});
```

can ensure a file contains a certain piece of text.

```js
ssh.writeFile(hostPwd, tmpRemotePath+'/remote5'+t, t, function(err){
  ssh.ensureFileContains(hostPwd, tmpRemotePath+'/remote5'+t, t, function(contains, err){
    (contains).should.be.true;
    done(err);
  });
});
```

can create a directory.

```js
ssh.mkdir(hostPwd, '/home/vagrant/examples', function(err){
  (!!err).should.be.false;
  ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err){
    (!!err).should.be.false;
    done();
  });
});
```

can put a directory.

```js
ssh.putDir(hostPwd, __dirname+'/../examples', '/home/vagrant/examples', function(err, server, conn){
  (!!err).should.be.false;
  ssh.fileExists(conn, '/home/vagrant/examples/exec.js', function(err){
    (!!err).should.be.false;
    done();
  });
});
```

can delete a directory.

```js
ssh.rmdir(hostPwd, '/home/vagrant/examples', function(err){
  (!!err).should.be.false;
  ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err, exists){
    (!!err).should.be.true;
    (err.message).should.match(/No such file/i);
    done();
  });
});
```

<a name="sftp-failures"></a>
# sftp failures
can fail correctly when it can t test if a file.

```js
ssh.fileExists(hostPwd, '/root/.bashrc', function(err){
  (!!err).should.be.true;
  err.code.should.eql(3);
  err.message.should.match(/Permission denied/);
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
  ssh.rmdir(hostPwd, '/root/some', function(err){
    (!!err).should.be.true;
    err.code.should.eql(3);
    err.message.should.match(/Permission denied/);
    done();
  });
});
```

<a name="exec-failures"></a>
# exec failures
can fail correctly when it can t execute a command.

```js
ssh.exec(hostPwd, 'echo some >> /root/cannot', function(err,stdout,stderr){
  (!!err).should.be.true;
  err.message.should.match(/Permission denied/);
  done();
});
```
