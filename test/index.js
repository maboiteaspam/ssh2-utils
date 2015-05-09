
require('should');
var fs = require('fs-extra');
var _ = require('underscore');
var Vagrant = require('node-vagrant-bin');

var pwd = {};
if( process.env['TRAVIS'] )
  pwd = require('./travis-ssh.json');
else
  pwd = require('./vagrant-ssh.json');

var SSH2Utils = require('../index.js');
var ssh = new SSH2Utils();

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

var tmpRemotePath = '/tmp/tmp_remote';
var fixturePath = __dirname + '/fixtures/';


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
      (!!err).should.be.true;
      (stdout===null).should.be.true;
      (err.message).should.match(/failed/);
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
      (!!err).should.be.true;
      (stdout===null).should.be.true;
      (err.message).should.match(/failed/);
      (stderr).should.match(/failed/);
      done();
    });
  });
});

describe('exec', function(){
  this.timeout(50000)
  it('can execute command', function(done){
    ssh.exec(hostPwd,'ls -alh /var/log/', function(err, stdout, stderr, server){
      (!!err).should.be.false;
      stdout.should.match(/root/);
      stderr.should.be.empty;
      done()
    });
  });
  it('can execute command with private key', function(done){
    ssh.exec(hostKey,'ls -alh /var/log/', function(err, stdout, stderr, server){
      (!!err).should.be.false;
      stdout.should.match(/root/);
      stderr.should.be.empty;
      done()
    });
  });
  it('can execute sudo command', function(done){
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
  });
  it('can connect with private key and execute sudo command', function(done){
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
  });
  it('can fail properly', function(done){
    ssh.exec(hostPwd,'ls -alh /var/log/nofile', function(err, stdout, stderr, server){
      (!!err).should.be.true;
      stderr.should.match(/No such file or directory/);
      err.message.should.match(/No such file or directory/);
      stdout.should.be.empty;
      done();
    });
  });
  it('can fail properly', function(done){
    ssh.exec(hostPwd, 'dsscdc', function(err, stdout, stderr, server){
      (!!err).should.be.true;
      stderr.should.match(/command not found/);
      err.message.should.match(/command not found/);
      stdout.should.be.empty;
      done();
    });
  });
});


describe('run', function(){
  this.timeout(50000);
  it('can run sudo command with password', function(done){
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
  });
  it('can connect with private key and run sudo command with password', function(done){
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
        stderr.should.match(/No such file or directory/)
        stdout.should.be.empty
        conn.end();
        done();
      });
      (!!err).should.be.false;
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
        stderr.should.match(/command not found/);
        stdout.should.be.empty;
        conn.end();
        done();
      });
      (!!err).should.be.false;
    });
  });
});


describe('run multiple', function(){
  this.timeout(50000);
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


describe('sftp ensureEmptyDir', function(){
  this.timeout(50000);

  before(function(done){
    fs.mkdirsSync(fixturePath);
    ssh.rmdirSudo(hostPwd, '/home/vagrant/putdir-test', function(err, server, conn){
      ssh.rmdirSudo(conn, '/tmp/empty-dir-sudo', function(err, server, conn){
        ssh.rmdirSudo(conn, '/tmp/empty-dir-sudo-fail', function(err, stdout, stderr, server, conn){
          done();
        });
      });
    });
  });
  it('can ensure a remote dir is empty and exists', function(done){
    ssh.ensureEmptyDir(hostPwd, '/home/vagrant/putdir-test', function(err, server, conn){
      ssh.fileExists(conn, '/home/vagrant/putdir-test', function(err2, exists){
        (!!err).should.be.false;
        (exists).should.be.true;
        done();
      });
    });
  });
  it('can ensure a remote dir is empty and exists via sudo', function(done){
    ssh.ensureEmptyDirSudo(hostPwd, '/tmp/empty-dir-sudo', function(err, server, conn){
      ssh.fileExistsSudo(conn, '/tmp/empty-dir-sudo', function(err2, exists){
        (!!err).should.be.false;
        (exists).should.be.true;
        done();
      });
    });
  });
  it('can fail properly', function(done){
    ssh.ensureEmptyDir(hostPwd, '/root/empty-dir-sudo-fail', function(err, server, conn){
      ssh.fileExists(conn, '/root/empty-dir-sudo-fail', function(err2, exists){
        (!!err).should.be.true;
        (exists).should.be.false;
        done();
      });
    });
  });
});


describe('sftp fileExists', function(){
  this.timeout(50000);

  it('can ensure a remote path exists', function(done){
    ssh.ensureEmptyDir(hostPwd, '/home/vagrant/fileExists-test', function(err, server, conn){
      (!!err).should.be.false;
      ssh.fileExists(conn, '/home/vagrant/fileExists-test', function(err2, exists){
        (!!err2).should.be.false;
        (exists).should.be.true;
        done();
      });
    });
  });
  it('can ensure a remote path exists via sudo', function(done){
    ssh.ensureEmptyDirSudo(hostPwd, '/home/vagrant/fileExists-test', function(err, server, conn){
      (!!err).should.be.false;
      ssh.fileExistsSudo(conn, '/home/vagrant/fileExists-test', function(err2, exists){
        (!!err2).should.be.false;
        (exists).should.be.true;
        done();
      });
    });
  });
  it('can fail properly', function(done){
    ssh.fileExists(hostPwd, '/root/fileExists-fail', function(err, exists){
      (!!err).should.be.true;
      (exists).should.be.false;
      done();
    });
  });
});


describe('sftp putDir', function(){
  this.timeout(50000);
  var t = (new Date()).getTime();

  before(function(done){
    fs.mkdirsSync(fixturePath);
    ssh.exec(hostPwd, 'sudo rm -fr '+tmpRemotePath+'', function(err, stdout, stderr, server, conn){
      ssh.exec(conn, 'sudo mkdir -p '+tmpRemotePath+'', function(){
        ssh.exec(conn, 'sudo chmod -R 0777 '+tmpRemotePath+'', function(){
          ssh.exec(conn, 'sudo rm -fr /root/putdir-test*', function(){
            fs.mkdirsSync(fixturePath);
            fs.emptyDirSync(fixturePath);
            fs.writeFileSync(fixturePath+'/temp'+t, t);
            done();
          });
        });
      });
    });
  });
  it('can put a local dir to a remote', function(done){
    ssh.putDir(hostPwd, fixturePath, tmpRemotePath+'/putdir-test', function(err, server, conn){
      ssh.fileExists(conn, tmpRemotePath+'/putdir-test/temp'+t, function(err2, exists){
        (!!err).should.be.false;
        (exists).should.be.true;
        done();
      });
    });
  });
  it('can put a local dir to a remote via sudo', function(done){
    ssh.putDirSudo(hostPwd, fixturePath, '/root/putdir-test', function(err, server, conn){
      (!!err).should.be.false;
      ssh.fileExistsSudo(conn, '/root/putdir-test/temp'+t, function(err2, exists){
        console.log(err2);
        (!!err2).should.be.false;
        (exists).should.be.true;
        done();
      });
    });
  });
  it('can fail properly', function(done){
    ssh.putDir(hostPwd, fixturePath, '/root/putdir-test-fail', function(err, server, conn){
      ssh.fileExists(conn, '/root/putdir-test-fail/temp'+t, function(err2, exists){
        (!!err).should.be.true;
        (exists).should.be.false;
        done();
      });
    });
  });
});


describe('sftp', function(){
  this.timeout(50000);
  var t = (new Date()).getTime();

  before(function(done){
    fs.mkdirsSync(fixturePath);
    ssh.exec(hostPwd, 'sudo rm -fr '+tmpRemotePath+'', function(){
      ssh.exec(hostPwd, 'sudo mkdir -p '+tmpRemotePath+'', function(){
        ssh.exec(hostPwd, 'sudo chmod -R 0777 '+tmpRemotePath+'', function(){
          done();
        });
      });
    });
  });
  it('can test file exists', function(done){
    ssh.fileExists(hostPwd, '/home/vagrant/.bashrc', function(err, exists){
      (!!err).should.be.false;
      (exists).should.be.true;
      done();
    });
  });
  it('can write a file', function(done){
    fs.writeFileSync(fixturePath + 'local'+t, t);
    ssh.putFile(hostPwd, fixturePath + 'local'+t, tmpRemotePath+'/remote'+t, function(err, server, conn){
      (!!err).should.be.false;
      ssh.fileExists(conn, tmpRemotePath+'/remote'+t, function(err, exists){
        (!!err).should.be.false;
        (exists).should.be.true;
        done();
      });
    });
  });
  it('can download a file', function(done){
    ssh.readFile(hostPwd, tmpRemotePath+'/remote'+t, fixturePath + 'local'+t, function(err){
      (!!err).should.be.false;
      fs.readFileSync(fixturePath + 'local'+t,'utf-8').should.eql(''+t);
      done();
    });
  });
  it('can write a file content', function(done){
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
  });
  it('can ensure a file contains a certain piece of text', function(done){
    ssh.writeFile(hostPwd, tmpRemotePath+'/remote5'+t, t, function(err){
      ssh.ensureFileContains(hostPwd, tmpRemotePath+'/remote5'+t, t, function(contains, err){
        (contains).should.be.true;
        done(err);
      });
    });
  });
  it('can create a directory', function(done){
    ssh.mkdir(hostPwd, '/home/vagrant/examples', function(err){
      (!!err).should.be.false;
      ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err){
        (!!err).should.be.false;
        done();
      });
    });
  });
  it('can put a directory', function(done){
    ssh.putDir(hostPwd, __dirname+'/../examples', '/home/vagrant/examples', function(err, server, conn){
      (!!err).should.be.false;
      ssh.fileExists(conn, '/home/vagrant/examples/exec.js', function(err){
        (!!err).should.be.false;
        done();
      });
    });
  });
  it('can delete a directory', function(done){
    ssh.rmdir(hostPwd, '/home/vagrant/examples', function(err){
      (!!err).should.be.false;
      ssh.fileExists(hostPwd, '/home/vagrant/examples', function(err, exists){
        (!!err).should.be.true;
        (err.message).should.match(/No such file/i);
        done();
      });
    });
  });
});


describe('sftp failures', function(){
  this.timeout(10000);
  it('can fail correctly when it can t test if a file', function(done){
    ssh.fileExists(hostPwd, '/root/.bashrc', function(err){
      (!!err).should.be.true;
      err.code.should.eql(3);
      err.message.should.match(/Permission denied/);
      done();
    });
  });
  it('can fail correctly when it can t write a file', function(done){
    ssh.writeFile(hostPwd, '/root/cannot', 'some', function(err){
      (!!err).should.be.true;
      err.code.should.eql(3);
      err.message.should.match(/Permission denied/);
      done();
    });
  });
  it('can fail correctly when it can t mkdir', function(done){
    ssh.mkdir(hostPwd, '/root/cannot', function(err){
      (!!err).should.be.true;
      err.code.should.eql(3);
      err.message.should.match(/Permission denied/);
      done();
    });
  });
  it('can fail correctly when it can t rmdir', function(done){
    ssh.exec(hostPwd, 'sudo mkdir -p /root/some', function(err,stdout,sterr,sever,conn){
      ssh.rmdir(hostPwd, '/root/some', function(err){
        (!!err).should.be.true;
        err.code.should.eql(3);
        err.message.should.match(/Permission denied/);
        done();
      });
    });
  });
});


describe('exec failures', function(){
  it('can fail correctly when it can t execute a command', function(done){
    ssh.exec(hostPwd, 'echo some >> /root/cannot', function(err,stdout,stderr){
      (!!err).should.be.true;
      err.message.should.match(/Permission denied/);
      done();
    });
  });
});
