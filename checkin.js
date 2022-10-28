import { login } from './utils/login.js'
import { ClassData, ActivityData, PcCommonCheckIn, PptCheckIn } from './configs/api.js'
import { users } from './configs/users.js'
import { workTime } from './utils/workTime.js';
import { push } from './utils/push.js';
import { HeartBeat, defaultLoc } from './configs/config.js';
import axios from 'axios';
import schedule from 'node-schedule';
import esMain from 'es-main';


if(users.length == 0) {
    process.exit(1);
}


class CheckIn {
    constructor(uid, pwd) {
        this.uid = uid;
        this.pwd = pwd;
        this.credit = undefined;
        this._uid = undefined;
        this.headers = {
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 (schild:eaf4fb193ec970c0a9775e2a27b0232b) (device:iPhone11,2) Language/zh-Hans com.ssreader.ChaoXingStudy/ChaoXingStudy_3_6.0.2_ios_phone_202209281930_99 (@Kalimdor)_1665876591620212942'
        }
    }

    getCredit = async() => {
        const credit = await login(this.uid, this.pwd);
        if(!credit) {
            return false;
        }
        for(let i=0; i<credit.length; i++) {
            if(credit[i].startsWith('_uid=')) {
                this._uid = credit[i].split('_uid=')[1].split(';')[0];
                break;
            }
        }
        this.credit = credit;
        this.headers['Cookie'] = credit;
        return true;
    }

    getCourseId = async() => {
        const _headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Referer': 'http://mooc1-2.chaoxing.com/visit/interaction',
            'Host': 'mooc1-2.chaoxing.com',
            'Origin': 'http://mooc1-2.chaoxing.com'
        }
        const courselist = await axios({
            url: ClassData.url,
            method: ClassData.method,
            headers: Object.assign(this.headers, _headers)
        }).then(data => {
            return data;
        }).then(data => {
            return data.data;
        }).catch(err => {
            return;
        })
        if(!courselist || !courselist.result || courselist.result != 1 || !courselist.channelList) {
            return [];
        }
        const clist = courselist.channelList;
        const res = [];
        for(let i=0; i<clist.length; i++) {
            const channel = clist[i];
            res.push([channel.content.id, channel.content.course.data[0].id]);
        }
        return res;
    }


    getActivities = async (courseid, classid) => {
        const res = [];
        const _headers = {
            'Host': 'mobilelearn.chaoxing.com'
        }
        const activitylist = await axios({
            url: ActivityData.url,
            method: ActivityData.method,
            headers: Object.assign(this.headers, _headers),
            params: {
                classId: classid,
                courseId: courseid
            }
        }).then(data => {
            return data;
        }).then(data => {
            return data.data;
        }).catch(err => {
            return;
        })
        if(!activitylist || !activitylist.groupList || activitylist.groupList.length == 0 || activitylist.status != 1) {
            return -1;
        }
        const alist = activitylist.activeList;
        for(let i=0; i<alist.length; i++) {
            const item = alist[i];
            if(item.status != 1) {
                continue;
            }
            res.push(item.url);
        }
        return res;
    }


    checkRequest = async (url, method, paras) => {
        let retry = 5;
        while(retry >= 0) {
            const req = await axios({
                url: url,
                method: method,
                headers: this.headers,
                params: paras
            }).then(data => {
                return data;
            }).then(data => {
                console.log('签到成功。')
                return data.data;
            }).catch(err => {
                console.log('签到失败。正在重试...')
                return;
            })
            if(req) {
                return 1;
            } else {
                retry--;
            }
        }
        await push('签到失败', `一项签到活动失败,请检查`);
        return 2;
    }


    checkActivity = async (url) => {
        const signPage = await axios({
            url: url,
            method: 'GET',
            headers: this.headers
        }).then(data => {
            return data;
        }).then(data => {
            return data.data;
        }).catch(err => {
            return;
        })
        if(!signPage) {
            return;
        }
        const urlObj = new URL(url);
        const classid = urlObj.searchParams.get('classId');
        const courseid = urlObj.searchParams.get('courseId');
        const activeid = urlObj.searchParams.get('activePrimaryId');
        if(
            signPage.indexOf('输入发起者设置的签到码完成签到') != -1 || 
            signPage.indexOf('重绘发起者传达的手势图案完成签到') != -1
        ) 
        {
            // 手势/签到码签到
            const paras = {
                activeId: activeid,
                uid: this._uid,
                clientip: '',
                latitude: '',
                longitude: '',
                appType: 15,
                fid: 0,
                name: ''
            }
            return this.checkRequest(PptCheckIn.url, PptCheckIn.method, paras);
        }
        if(signPage.indexOf('同意提交位置信息') != -1) {
            const long = defaultLoc.long, lati = defaultLoc.lati; // 先只使用默认值
            // 位置签到
            const getLocGd = async (longitude, latitude) => {
                return axios({
                    url: 'https://mobilelearn.chaoxing.com/pptSign/mapbd2gd',
                    method: 'GET',
                    params: {
                        longitude,
                        latitude,
                        DB_STRATEGY: 'DEFAULT'
                    }
                }).then(data => {
                    return data.data;
                }).then(res => {
                    const result = res;
                    if(!result || !result.weidu_gd || !result.jingdu_gd) {
                        return [];
                    } else {
                        return [result.weidu_gd, result.jingdu_gd];
                    }
                })
            }
            const gds = await getLocGd(long, lati);
            const paras = {
                address: defaultLoc.name,
                uid: this._uid,
                clientip: '',
                activeId: activeid,
                latitude: lati,
                longitude: long,
                latitude_gd: gds[0],
                longitude_gd: gds[1],
                fid: 3253,
                appType: 15,
                ifTiJiao: 1
            }
            return this.checkRequest(PptCheckIn.url, PptCheckIn.method, paras);
        }
        if(signPage.indexOf('<title>签到</title>') != -1) {
            // 普通签到
            const paras = {
                activeId: activeid,
                classid: classid,
                courseid: courseid
            }
            return await this.checkRequest(PcCommonCheckIn.url, PcCommonCheckIn.method, paras);
        }
        return 1;
    }
}


const Main = async () => {
    for(let i=0; i<users.length; i++) {
        let retry;
        const uid = users[i].id, pwd = users[i].pwd;
        const checkInClass = new CheckIn(uid, pwd);
        let login = await checkInClass.getCredit();
        retry = 5;
        while((!login || !checkInClass.credit || !checkInClass._uid) && retry >= 0) {
            console.log(`${uid}登录失败,正在重试...`);
            login = await checkInClass.getCredit();
            retry--;
        }
        if(!login || !checkInClass.credit || !checkInClass._uid) {
            console.log(`${uid}登录失败`);
            push('登录失败', `${uid}登录失败,请检查`);
            continue;
        } else {
            console.log(`${uid}登录成功`);
        }
        let courses = await checkInClass.getCourseId();
        console.log(`寻找到${courses.length}门课程。正在寻找签到活动...`)
        retry = 5;
        while(courses.length == 0 && retry >= 0) {
            courses = await checkInClass.getCourseId();
            retry--;
        }
        if(courses.length == 0) {
            push('没有找到课程', `${uid}没有可获取的课程, 请检查`);
        }
        for(let i=0; i<courses.length; i++) {
            let acts = await checkInClass.getActivities(courses[i][1], courses[i][0]);
            retry = 5;
            while(acts == -1 && retry >= 0) {
                acts = await checkInClass.getActivities(courses[i][1], courses[i][0]);
                retry--;
            }
            if(acts == -1) {
                push('活动获取失败',`${uid}课程活动获取失败,请检查`);
                continue;
            }
            if(acts.length > 0) {
                console.log(`在课程${courses[i][1]}中找到${acts.length}项活动。`);
                for(let i=0; i<acts.length; i++) {
                    await checkInClass.checkActivity(acts[i]);
                }
            }
        }
    }
}


if(esMain(import.meta)) {
    await Main();
    console.log('开始定时任务');
    schedule.scheduleJob('0 */10 * * * *', async function() {
        axios({
            url: HeartBeat.url,
            method: HeartBeat.method
        })
        console.log(new Date());
        const isOff = await workTime();
        if(isOff) {
            console.log('不在签到时段')
        } else {
            await Main();
            console.log('等待下次任务开始');
        }
    })
}