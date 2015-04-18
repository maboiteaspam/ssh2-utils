
require('should');
var fs = require('fs')

var pwd = {};
if( process.env['TRAVIS'] )
  pwd = require('./travis-ssh.json');
else
  pwd = require('../examples/pwd.json');

var SSH2Utils = require('../index.js');
var ssh = new SSH2Utils();
ssh.log.level = 'verbose';

var host = {
  'host':'127.0.0.1',
  port: 22,
  username: pwd.localhost.user,
  password: pwd.localhost.pwd,
  privateKey: pwd.localhost.privateKey?fs.readFileSync(pwd.localhost.privateKey):null
};


describe('ident', function(){
  this.timeout(50000)
  it('exec can fail properly', function(done){
    var wrongHost = {
      'host':host.host,
      port: host.port,
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
  it('run can fail properly', function(done){
    var wrongHost = {
      'host':host.host,
      port: host.port,
      username: 'wrong',
      privateKey: host.privateKey
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
    ssh.exec(host,'ls -alh /var/log/', function(err, stdout, stderr, server){
      (err).should.be.false;
      stdout.should.match(/root/);
      stderr.should.be.empty;
      done()
    });
  });
  it('can execute sudo command', function(done){
    ssh.exec(host,'sudo ls -alh', function(err, stdout, stderr, server){
      (err).should.be.false;
      stdout.should.match(/\.npm/);
      stderr.should.be.empty;
      done();
    });
  });
  it('can fail properly', function(done){
    ssh.exec(host,'ls -alh /var/log/nofile', function(err, stdout, stderr, server){
      if(err) return console.log(err)
      stderr.should.match(/No such file or directory/)
      stdout.should.be.empty
      done()
    });
  });
  it('can fail properly', function(done){
    ssh.exec(host,'dsscdc', function(err, stdout, stderr, server){
      if(err) return console.log(err)
      stderr.should.match(/command not found/)
      stdout.should.be.empty
      done()
    });
  });
});


describe('run', function(){
  this.timeout(50000)
  it('can run sudo command', function(done){
    ssh.run(host,'sudo tail -f /var/log/{auth.log,secure}', function(err, stdouts, stderrs, server, conn){
      (err).should.be.false;
      var stdout = '';
      stdouts.on('data', function(data){
        stdout+=''+data;
      });
      setTimeout(function(){
        stdout.toString().should.match(/tail -f/)
        conn.end()
        done();
      },1000)
    });
  });
  it('run can fail properly', function(done){
    ssh.run(host,'ls -alh /var/log/nofile', function(err, stdouts, stderrs, server, conn){
      var stdout = '';
      var stderr = '';
      stdouts.on('data', function(data){
        stdout+=''+data;
      });
      stderrs.on('data', function(data){
        stderr+=''+data;
      });
      setTimeout(function(){
        console.log(stdout)
        console.log(stderr)
        stderr.should.match(/No such file or directory/)
        stdout.should.be.empty
        conn.end()
        done();
      },1000);
      (err).should.be.false;
    });
  });
  it('run can fail properly', function(done){
    ssh.run(host,'dsscdc', function(err, stdouts, stderrs, server, conn){
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

    var onDone = function(sessionText, sshObj){
      console.log(sessionText)
      console.log('All done')
      sessionText.toString().should.match(/hello/)
      done();
    };

    var onCommandComplete = function(command, response, server){

    }

    ssh.runMultiple(host, cmds, onCommandComplete, onDone);

  })
});