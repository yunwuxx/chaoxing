import axios from 'axios';
import cryptojs from 'crypto-js';
import fs from 'fs';
import { ClassData } from '../configs/api.js';


function encryptByDES(message, key){
	var keyHex = cryptojs.enc.Utf8.parse(key);
	var encrypted = cryptojs.DES.encrypt(message, keyHex, {
		mode: cryptojs.mode.ECB,
		padding: cryptojs.pad.Pkcs7
	});
	return encrypted.ciphertext.toString();
}


const getToken = async (pwd) => {
    const getKey = async () => {
        var url = "https://passport2.chaoxing.com/js/fanya/login.js";
        var rg = /transferKey\s*?=\s*?['"](.+?)['"]/;
        var req = await axios.get(url);
        return req.data.match(rg)[1];
    }
    return getKey().then(key => {
        return encryptByDES(pwd, key);
    })
}


export const login = async (uid, pwd) => {
    const _cookies = JSON.parse(fs.readFileSync('./data/cookies.json', 'utf-8'));
    const cookie = _cookies[uid];
    if(cookie) {
        const valid = await axios({
            url: ClassData.url,
            method: ClassData.method,
            headers: {
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 (schild:eaf4fb193ec970c0a9775e2a27b0232b) (device:iPhone11,2) Language/zh-Hans com.ssreader.ChaoXingStudy/ChaoXingStudy_3_6.0.2_ios_phone_202209281930_99 (@Kalimdor)_1665876591620212942',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Referer': 'http://mooc1-2.chaoxing.com/visit/interaction',
                'Host': 'mooc1-2.chaoxing.com',
                'Origin': 'http://mooc1-2.chaoxing.com',
                'Cookie': cookie
            }
        }).then(data => {
            return data.data;
        }).then(data => {
            if(data.indexOf('请重新登录') != -1 || data.indexOf('用户登录') != -1) {
                console.log('本地Cookie无效, 重新登录');
                return false;
            } else {
                return true;
            }
        }).catch(err => {
            return false;
        })
        if(valid) {
            return cookie;
        }
    }
    return axios({
        url: 'http://passport2.chaoxing.com/fanyalogin',
        method: 'POST',
        headers: {
            'User-Agent': ' Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
        },
        params: {
            'fid': -1,
            'uname': uid,
            'password': await getToken(pwd),
            'refer': 'http%3A%2F%2Fi.chaoxing.com',
            't': 'true',
            'forbidotherlogin': 0,
            'validate': '',
            'doubleFactorLogin': 0,
            'independentId': 0
        }
    }).then(data => {
        return data;
    }).then(data => {
        const res = data.data;
        if(!res || !res.status) {
            return;
        } else {
            const gotCookie = data.headers['set-cookie'];
            const _cookie = JSON.parse(fs.readFileSync('./data/cookies.json', 'utf-8'));
            _cookie[uid] = gotCookie;
            fs.writeFileSync('./data/cookies.json', JSON.stringify(_cookie), 'utf-8');
            return gotCookie;
        }
    }).catch(err => {
        console.log(err);
        return;
    })
}