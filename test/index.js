
require('should');
var fs = require('fs');
var _ = require('underscore');
var Vagrant = require('node-vagrant-bin');

var pwd = {};
if( process.env['TRAVIS'] )
  pwd = require('./travis-ssh.json');
else
  pwd = require('./vagrant-ssh.json');

var SSH2Utils = require('../index.js');
var ssh = new SSH2Utils();
ssh.log.level = 'verbose';

var hostKey = {
  'host':'127.0.0.1',
  port: pwd.localhost.port || 22,
  username: pwd.localhost.user,
  password: pwd.localhost.pwd || undefined,
  privateKey: pwd.localhost.privateKey?fs.readFileSync(pwd.localhost.privateKey):null
};

var hostPwd = {
  'host':'127.0.0.1',
  port: pwd.localhostpwd.port || 22,
  username: pwd.localhostpwd.user,
  password: pwd.localhostpwd.pwd || undefined
};
if( process.env['TRAVIS'] ){
  hostPwd.privateKey = hostKey.privateKey;
}


if( !process.env['TRAVIS'] ){

  var vagrant = new Vagrant();

  var hasBooted = true;

  before(function(done){
    this.timeout(50000);
    vagrant.isRunning(function(running){
      if(running===false){
        vagrant.up('precise64',function(err,booted){
          hasBooted = booted;
          done();
        });
      }else{
        console.log('running machine '+running);
        hasBooted = false;
        done();
      }
    });
  });

  after(function(done){
    this.timeout(50000);
    vagrant.isRunning(function(running){
      console.log('running machine '+running);
      if(hasBooted){
        vagrant.halt(function(){
          console.log('halted');
          done();
        });
      } else {
        done();
      }
    });
  });

}


describe('ident', function(){
  this.timeout(50000)
  it('exec can fail properly with password', function(done){
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
  });
  it('run can fail properly with private key', function(done){
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
  });
});

describe('exec', function(){
  this.timeout(50000)
  it('can execute command', function(done){
    ssh.exec(hostPwd,'ls -alh /var/log/', function(err, stdout, stderr, server){
      if(err!==undefined) (err).should.be.false;
      stdout.should.match(/root/);
      stderr.should.be.empty;
      done()
    });
  });
  it('can execute command with private key', function(done){
    ssh.exec(hostKey,'ls -alh /var/log/', function(err, stdout, stderr, server){
      if(err!==undefined) (err).should.be.false;
      stdout.should.match(/root/);
      stderr.should.be.empty;
      done()
    });
  });
  it('can execute sudo command', function(done){
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
  });
  it('can connect with private key and execute sudo command', function(done){
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
  });
  it('can fail properly', function(done){
    ssh.exec(hostPwd,'ls -alh /var/log/nofile', function(err, stdout, stderr, server){
      if(err!==undefined) (err).should.be.false;
      stdout.should.match(/No such file or directory/)
      stderr.should.be.empty
      done()
    });
  });
  it('can fail properly', function(done){
    ssh.exec(hostPwd,'dsscdc', function(err, stdout, stderr, server){
      if(err!==undefined) (err).should.be.false;
      stdout.should.match(/command not found/)
      stderr.should.be.empty
      done()
    });
  });
});


describe('run', function(){
  this.timeout(50000)
  it('can run sudo command with password', function(done){
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
  });
  it('can connect with private key and run sudo command with password', function(done){
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
  });
  it('run can fail properly', function(done){
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
  });
  it('run can fail properly', function(done){
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
  });
});


describe('run multiple', function(){
  this.timeout(50000)
  it('can run multiple commands', function(done){

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

  })
});


describe('sftp', function(){
  this.timeout(50000);
  var t = (new Date()).getTime();
  before(function(){

  });
  it('can test file exists', function(done){
    ssh.fileExists(hostPwd, '/home/vagrant/.bashrc', function(err){
      if(err!==undefined) (err).should.be.true;
      done();
    });
  });
  it('can write a file', function(done){
    fs.writeFileSync('/tmp/local'+t, t);
    ssh.putFile(hostPwd, '/tmp/local'+t, '/tmp/remote'+t, function(err){
      if(err!==undefined) (err).should.be.true;
      ssh.fileExists(hostPwd, '/tmp/remote'+t, function(err){
        if(err!==undefined) (err).should.be.true;
        done();
      });
    });
  });
  it('can download a file', function(done){
    ssh.readFile(hostPwd, '/tmp/remote'+t, '/tmp/local'+t, function(err){
      if(err!==undefined) (err).should.be.true;
      fs.readFileSync('/tmp/local'+t,'utf-8').should.eql(''+t);
      done();
    });
  });
  it('can write a file content', function(done){
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
  });
  it('can create a directory', function(done){
    ssh.mkdir(hostPwd, '/home/vagrant/examples', function(err){
      if(err!==undefined) (err).should.be.true;
      ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err){
        if(err!==undefined) (err).should.be.true;
        done();
      });
    });
  });
  it('can put a directory', function(done){
    ssh.putDir(hostPwd, __dirname+'/../examples', '/home/vagrant/examples', function(err, server, conn){
      if(err!==undefined) (err).should.be.true;
      conn.end();
      ssh.fileExists(hostPwd, '/home/vagrant/examples/exec.js', function(err){
        if(err!==undefined) (err).should.be.true;
        done();
      });
    });
  });
  it('can delete a directory', function(done){
    ssh.rmdir(hostPwd, '/home/vagrant/examples', function(err){
      if(err!==undefined) (err).should.be.true;
      ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err){
        if(err!==undefined) (''+err).should.match(/error/i);
          (!err).should.be.false;
        done();
      });
    });
  });
});
