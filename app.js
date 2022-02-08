const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const _ = require('lodash');
const fs = require('fs');
const { logger } = require('kv-logger');

const config = require('./core/config');
const routes = require('./routes/index');
const indexV1 = require('./routes/indexV1');
const auth = require('./routes/auth');
const accessKeys = require('./routes/accessKeys');
const account = require('./routes/account');
const users = require('./routes/users');
const apps = require('./routes/apps');
const { AppError, NotFound } = require('./core/app-error');

const app = express();

app.use(
    helmet({
        contentSecurityPolicy: false,
    }),
);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

logger.debug('use set Access-Control Header');
app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CodePush-Plugin-Version, X-CodePush-Plugin-Name, X-CodePush-SDK-Version',
    );
    res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,PATCH,DELETE,OPTIONS');
    next();
});

logger.debug('config common.storageType value: ' + _.get(config, 'common.storageType'));

if (_.get(config, 'common.storageType') === 'local') {
    var localStorageDir = _.get(config, 'local.storageDir');
    if (localStorageDir) {
        logger.debug('config common.storageDir value: ' + localStorageDir);

        if (!fs.existsSync(localStorageDir)) {
            var e = new Error(`Please create dir ${localStorageDir}`);
            logger.error(e);
            throw e;
        }
        try {
            logger.debug('checking storageDir fs.W_OK | fs.R_OK');
            fs.accessSync(localStorageDir, fs.W_OK | fs.R_OK);
            logger.debug('storageDir fs.W_OK | fs.R_OK is ok');
        } catch (e) {
            logger.error(e);
            throw e;
        }
        logger.debug('static download uri value: ' + _.get(config, 'local.public', '/download'));
        app.use(_.get(config, 'local.public', '/download'), express.static(localStorageDir));
    } else {
        logger.error('please config local storageDir');
    }
}

app.use('/', routes);
app.use('/v0.1/public/codepush', indexV1);
app.use('/auth', auth);
app.use('/accessKeys', accessKeys);
app.use('/account', account);
app.use('/users', users);
app.use('/apps', apps);

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (req, res, next) {
        var err = new NotFound(`${req.method} ${req.url}`);
        res.status(err.status || 404);
        res.render('error', {
            message: err.message,
            error: err,
        });
        logger.error(err);
    });
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err,
        });
        logger.error(err);
    });
} else {
    app.use(function (req, res, next) {
        var e = new NotFound();
        res.status(404).send(e.message);
        logger.debug(e);
    });
    // production error handler
    // no stacktraces leaked to user
    app.use(function (err, req, res, next) {
        if (err instanceof AppError) {
            res.send(err.message);
            logger.debug(err);
        } else {
            res.status(err.status || 500).send(err.message);
            logger.error(err);
        }
    });
}

module.exports = app;
