# dhs

通过QQ机器人管理雀魂大会室后台  
目前QQ群和赛事ID为一对一关系  
使用[CQHTTP](https://cqhttp.cc/)协议，支持http上报或反向ws

### **依赖**

* nodejs-v8.10以上和相关npm包

### **安装**

```shell
# npm install
```

酷Q和插件的安装配置不做介绍。

### **配置**

* 编辑config.js文件，修改参数  
* 在系统环境变量中添加2个变量：  
MAJSOUL_DHS_ACCOUNT 雀魂账号  
MAJSOUL_DHS_PASSWORD 雀魂密码

### **启动**

* 推荐使用forever或pm2来启动进程，这样主人可以通过QQ输入"dhs重启"来重启进程  
* 目录需要有可写权限

安装forever并启动

```shell
# npm install forever -g
# forever start index.js
```

普通启动

```shell
# node index.js
```

启动后会在目录下生成一个db文件，用来保存QQ群和赛事ID的对应关系

### **使用**

QQ输入"dhs"查看帮助
