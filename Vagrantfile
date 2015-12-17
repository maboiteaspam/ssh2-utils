Vagrant.configure(2) do |config|

  config.vm.define "centos", primary: true do |centos|
    centos.vm.box_check_update = false
    centos.vm.box_url = "http://opscode-vm-bento.s3.amazonaws.com/vagrant/virtualbox/opscode_centos-7.0_chef-provisionerless.box"
    centos.vm.box = "centos"
  end

  config.vm.define "ubuntu", primary: true do |ubuntu|
    ubuntu.vm.box_check_update = false
    ubuntu.vm.box_url = "http://puppet-vagrant-boxes.puppetlabs.com/ubuntu-server-10044-x64-vbox4210-nocm.box"
    ubuntu.vm.box = "ubuntu"
  end
end
