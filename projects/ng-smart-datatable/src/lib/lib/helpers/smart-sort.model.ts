export class SmartSort{
    static sort(data:any[],property:string,orderByAsc = true):any[]{
        if(orderByAsc){
            return data.sort((a, b) => (a[`${property}`] > b[`${property}`]) ? 1 : -1) as any[];
        }else{
            return data.sort((a, b) => (a[`${property}`] < b[`${property}`]) ? 1 : -1) as any[];
        }
    }
}