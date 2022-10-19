import axios from 'axios';
import cryptojs from 'crypto-js';


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
            return data.headers['set-cookie'];
        }
    }).catch(err => {
        console.log(err);
        return;
    })
}