
require('should');

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
  privateKey: pwd.localhost.privateKey
};


describe('exec', function(){
  this.timeout(50000)
  it('can execute command', function(done){
    ssh.exec(host,'ls -alh', function(err, stdout, stderr, server){
      if(err) return console.log(err)
      stdout.should.match(/\.npm/)
      stderr.should.be.empty
      done()
    });
  })
  it('can execute sudo command', function(done){
    ssh.exec(host,'sudo ls -alh', function(err, stdout, stderr, server){
      if(err) return console.log(err)
      stdout.should.match(/\.npm/)
      stderr.should.be.empty
      done()
    });
  })
});


describe('run', function(){
  this.timeout(50000)
  it('can execute sudo command', function(done){
    ssh.run(host,'sudo tail -f /var/log/secure', function(err, stream, stderr, server, conn){
      if(err) return console.log(err)
      var stdout = '';
      stream.on('data', function(data){
        stdout+=''+data;
      })
      stream.on('close', function(){
        stdout.toString().should.match(/tail -f/)
        done();
      })
      setTimeout(function(){
        conn.end()
      },500)
    });
  })
});