import { PushApi } from "../configs/config.js";
import axios from 'axios';


export const push = async (title, msg) => {
    return axios({
        url: `${PushApi.url}/${title}/${msg}`,
        method: PushApi.method
    })
}