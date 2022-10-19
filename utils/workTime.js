import axios from 'axios';
import dayjs from 'dayjs';


export const workTime = async () => {
    const now = dayjs();
    const year = now.year();
    const hr = now.hour();
    if(hr <= 6 || hr >= 21) {
        return true;
    }
    return axios({
        url: `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
        timeout: 5000
    }).then(data => {
        return data;
    }).then(res => {
        if(!res.data || !res.data.days){
            return [];
        } else {
            return res.data.days;
        }
    }).then(days => {
        if(days.length == 0) {
            return now.day() >= 6;
        } else {
            for(let i=0; i<days.length; i++) {
                const item = days[i];
                const itemD = dayjs(item.date);
                if(itemD.isSame(now)) {
                    return item.isOffDay;
                }
            }
            return now.day() >= 6;
        }
    })
}