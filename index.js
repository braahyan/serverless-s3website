/**
 * Created by pedla on 12/16/2016.
 */
'use strict';


const BbPromise = require('bluebird');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const mime = require('mime');

const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {

        filelist = fs.statSync(path.join(dir, file)).isDirectory()
            ? walkSync(path.join(dir, file), filelist)
            : filelist.concat(path.join(dir, file));

});
    return filelist;
}

class Deploy {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.hooks = {
                'after:deploy:deploy': this.upload,
                'site:upload:upload': () => BbPromise.bind(this)
                .then(this.upload)
    };

        this.commands = {
            "site": {
                commands: {
                    upload: {
                        usage: 'Serve the WSGI application locally.',
                        lifecycleEvents: [
                            'upload',
                        ],
                    },
                },
            },
        };

    }

    upload() {
        const self = this;
        const s3 = new AWS.S3();
        const dirName = self.serverless.service.custom.site_dir;
        const bucketName = self.serverless.service.custom.site_bucket;
        if (!dirName || !bucketName){
            self.serverless.cli.log("define site_dir and site_bucket in custom")
            return;
        }

        // todo: add in checksum checking capability

        const files = walkSync(dirName);
        files.forEach(file => {
            fs.readFile(file, function(err, data) {
            if (err) throw err;
            let myFilePath = path.relative(dirName, file);
            const contentType = mime.lookup(file);
            if(myFilePath.includes("index.html") && myFilePath != "index.html"){
                myFilePath = myFilePath.replace(path.sep + "index.html","");
            }
            const params = {Bucket: bucketName, Key: myFilePath, Body: data, ContentType:contentType  };
            s3.putObject(params, function(err, data) {
                if (err){
                    self.serverless.cli.log(err)
                }
                else{
                    self.serverless.cli.log("Successfully uploaded " +
                        path.join(bucketName, path.relative(dirName, file)) +
                        " to " +
                        path.join(bucketName,myFilePath));
                }
            });
        });
    })
    };
}

module.exports = Deploy;