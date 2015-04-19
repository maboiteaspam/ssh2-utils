
require('should');
var fs = require('fs');

var pwd = {};
if( process.env['TRAVIS'] )
  pwd = require('./travis-ssh.json');
else
  pwd = require('./vagrant-ssh.json');

var SSH2Utils = require('../index.js');
var ssh = new SSH2Utils();
ssh.log.level = 'silly';

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

  var hasBooted = true;

  before(function(done){
    var vagrant = require('child_process').spawn('vagrant',['up'])
    vagrant.stdout.on('data', function (data) {
      console.log('stdout: ' + data);
      if(hasBooted && data.toString().match(/already running/) ) hasBooted = false;
    });
    vagrant.stderr.on('data', function (data) {
      console.log('stderr: ' + data);
    });
    vagrant.on('close', function (code) {
      console.log('child process exited with code ' + code);
      done();
    });
    this.timeout(50000);
  });

  after(function(done){
    if(hasBooted){
      var vagrant = require('child_process').spawn('vagrant',['halt'])
      vagrant.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
      });
      vagrant.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
      });
      vagrant.on('close', function (code) {
        console.log('child process exited with code ' + code);
        done();
      });
      this.timeout(50000);
    } else {
      done();
    }
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
      (err).should.be.false;
      stdout.should.match(/root/);
      stderr.should.be.empty;
      done()
    });
  });
  it('can execute command with private key', function(done){
    ssh.exec(hostKey,'ls -alh /var/log/', function(err, stdout, stderr, server){
      (err).should.be.false;
      stdout.should.match(/root/);
      stderr.should.be.empty;
      done()
    });
  });
  it('can execute sudo command', function(done){
    this.timeout(50000)
    ssh.exec(hostPwd,'sudo ls -alh', function(err, stdout, stderr, server,conn){
      (err).should.be.false;
      stdout.should.match(new RegExp(server.username));
      stderr.should.be.empty;
      // re use connection
      ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
        (err).should.be.false;
        stdout.should.match(new RegExp(server.username));
        stderr.should.be.empty;
        done();
      });
    });
  });
  it('can connect with private key and execute sudo command', function(done){
    this.timeout(50000)
    ssh.exec(hostKey,'sudo ls -alh', function(err, stdout, stderr, server,conn){
      (err).should.be.false;
      stdout.should.match(new RegExp(server.username));
      stderr.should.be.empty;
      // re use connection
      ssh.exec(conn,'sudo ls -alh', function(err, stdout, stderr){
        (err).should.be.false;
        stdout.should.match(new RegExp(server.username));
        stderr.should.be.empty;
        done();
      });
    });
  });
  it('can fail properly', function(done){
    ssh.exec(hostPwd,'ls -alh /var/log/nofile', function(err, stdout, stderr, server){
      (err).should.be.false;
      stdout.should.match(/No such file or directory/)
      stderr.should.be.empty
      done()
    });
  });
  it('can fail properly', function(done){
    ssh.exec(hostPwd,'dsscdc', function(err, stdout, stderr, server){
      (err).should.be.false;
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
          stdout2.on('data', function(data){
            data.toString().should.match(/root/)
            stdout.toString().should.match(/session/)
            conn.end()
            done();
          });
        });
      },2000);
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
          stdout2.on('data', function(data){
            data.toString().should.match(/root/)
            stdout.toString().should.match(/session/)
            conn.end()
            done();
          });
        });
      },2000);
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
      setTimeout(function(){
        stderr.should.match(/No such file or directory/)
        stdout.should.be.empty
        conn.end()
        done();
      },1000);
      (err).should.be.false;
    });
  });
  it('run can fail properly', function(done){
    ssh.run(hostPwd,'dsscdc', function(err, stdouts, stderrs, server, conn){
      var stdout = '';
      var stderr = '';
      stdouts.on('data', function(data){
        stdout+=''+data;
      });
      stderrs.on('data', function(data){
        stderr+=''+data;
      });
      setTimeout(function(){
        stderr.should.match(/command not found/)
        stdout.should.be.empty
        conn.end()
        done();
      },1000);
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
      (!err).should.be.true;
      sessionText.toString().should.match(/hello/)
      done();
    };

    var onCommandComplete = function(command, response, server){

    }

    ssh.runMultiple(hostPwd, cmds, onCommandComplete, onDone);

  })
});