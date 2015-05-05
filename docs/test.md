running machine precise64
running machine precise64
# TOC
   - [ident](#ident)
   - [exec](#exec)
   - [run](#run)
   - [run multiple](#run-multiple)
   - [sftp](#sftp)
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
ssh.exec(wrongHost,'ls -alh', function(err, stdout, stderr, server){
  (err).should.be.true;
  (stdout===null).should.be.true;
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
ssh.run(wrongHost,'ls -alh', function(err, stdout, stderr, server){
  (err).should.be.true;
  (stdout===null).should.be.true;
  (stderr).should.match(/failed/);
  done();
});
```

<a name="exec"></a>
# exec
can execute command.

```js
ssh.exec(hostPwd,'ls -alh /var/log/', function(err, stdout, stderr, server){
  if(err!==undefined) (err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  done()
});
```

can execute command with private key.

```js
ssh.exec(hostKey,'ls -alh /var/log/', function(err, stdout, stderr, server){
  if(err!==undefined) (err).should.be.false;
  stdout.should.match(/root/);
  stderr.should.be.empty;
  done()
});
```

can execute sudo command.

```js
this.timeout(50000)
ssh.exec(hostPwd,'sudo ls -alh', function(err, stdout, stderr, server,conn){
  if(err!==undefined) (err).should.be.false;
  stdout.should.match(new RegExp(server.username));
  stderr.should.be.empty;
  // re use connection
  ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
    if(err!==undefined) (err).should.be.false;
    stdout.should.match(new RegExp(server.username));
    stderr.should.be.empty;
    done();
  });
});
```

can connect with private key and execute sudo command.

```js
this.timeout(50000)
ssh.exec(hostKey,'sudo ls -alh', function(err, stdout, stderr, server,conn){
  if(err!==undefined) (err).should.be.false;
  stdout.should.match(new RegExp(server.username));
  stderr.should.be.empty;
  // re use connection
  ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
    if(err!==undefined) (err).should.be.false;
    stdout.should.match(new RegExp(server.username));
    stderr.should.be.empty;
    done();
  });
});
```

can fail properly.

```js
ssh.exec(hostPwd,'ls -alh /var/log/nofile', function(err, stdout, stderr, server){
  if(err!==undefined) (err).should.be.false;
  stdout.should.match(/No such file or directory/)
  stderr.should.be.empty
  done()
});
```

can fail properly.

```js
ssh.exec(hostPwd,'dsscdc', function(err, stdout, stderr, server){
  if(err!==undefined) (err).should.be.false;
  stdout.should.match(/command not found/)
  stderr.should.be.empty
  done()
});
```

<a name="run"></a>
# run
can run sudo command with password.

```js
ssh.run(hostPwd,'sudo tail -f /var/log/{auth.log,secure}', function(err, stdouts, stderrs, server, conn){
  (err).should.be.false;
  var stdout = '';
  stdouts.on('data', function(data){
    stdout+=''+data;
  });
  setTimeout(function(){
    // re use connection
    ssh.run(conn,'ls -alh /var/log/', function(err2, stdout2){
      stdout2.on('data', _.debounce(function(data){
        data.toString().should.match(/root/)
        stdout.toString().should.match(/session/)
        conn.end()
        done();
      },500));
    });
  },500);
});
```

can connect with private key and run sudo command with password.

```js
ssh.run(hostKey,'sudo tail -f /var/log/{auth.log,secure}', function(err, stdouts, stderrs, server, conn){
  (err).should.be.false;
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
    stdout.should.match(/No such file or directory/)
    stderr.should.be.empty
    conn.end()
    done();
  });
  (err).should.be.false;
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
    stdout.should.match(/command not found/);
    stderr.should.be.empty;
    conn.end()
    done();
  });
  (err).should.be.false;
});
```

<a name="run-multiple"></a>
# run multiple
can run multiple commands.

```js
var cmds = [
      'echo hello',
      'time',
      "`All done!`"
    ];
    var onDone = function(err, sessionText, sshObj){
      if(err!==undefined) (err).should.be.true;
      sessionText.toString().should.match(/hello/)
      done();
    };
    var onCommandComplete = function(command, response, server){
    }
    ssh.runMultiple(hostPwd, cmds, onCommandComplete, onDone);
```

<a name="sftp"></a>
# sftp
can test file exists.

```js
ssh.fileExists(hostPwd, '/home/vagrant/.bashrc', function(err){
  if(err!==undefined) (err).should.be.true;
  done();
});
```

can write a file.

```js
fs.writeFileSync('/tmp/local'+t, t);
ssh.putFile(hostPwd, '/tmp/local'+t, '/tmp/remote'+t, function(err){
  if(err!==undefined) (err).should.be.true;
  ssh.fileExists(hostPwd, '/tmp/remote'+t, function(err){
    if(err!==undefined) (err).should.be.true;
    done();
  });
});
```

can download a file.

```js
ssh.readFile(hostPwd, '/tmp/remote'+t, '/tmp/local'+t, function(err){
  if(err!==undefined) (err).should.be.true;
  fs.readFileSync('/tmp/local'+t,'utf-8').should.eql(''+t);
  done();
});
```

can write a file content.

```js
ssh.writeFile(hostPwd, '/tmp/remote2'+t, t, function(err){
  if(err!==undefined) (err).should.be.true;
  ssh.fileExists(hostPwd, '/tmp/remote2'+t, function(err){
    if(err!==undefined) (err).should.be.true;
    ssh.readFile(hostPwd, '/tmp/remote2'+t, '/tmp/local2'+t, function(err){
      if(err!==undefined) (err).should.be.true;
      fs.readFileSync('/tmp/local2'+t,'utf-8').should.eql(''+t);
      done();
    });
  });
});
```

can create a directory.

```js
ssh.mkdir(hostPwd, '/home/vagrant/examples', function(err){
  if(err!==undefined) (err).should.be.true;
  ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err){
    if(err!==undefined) (err).should.be.true;
    done();
  });
});
```

can put a directory.

```js
ssh.putDir(hostPwd, __dirname+'/../examples', '/home/vagrant/examples', function(err, server, conn){
  if(err!==undefined) (err).should.be.true;
  conn.end();
  ssh.fileExists(hostPwd, '/home/vagrant/examples/exec.js', function(err){
    if(err!==undefined) (err).should.be.true;
    done();
  });
});
```

can delete a directory.

```js
ssh.rmdir(hostPwd, '/home/vagrant/examples', function(err){
  if(err!==undefined) (err).should.be.true;
  ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err){
    if(err!==undefined) (''+err).should.match(/error/i);
      (!err).should.be.false;
    done();
  });
});
```

