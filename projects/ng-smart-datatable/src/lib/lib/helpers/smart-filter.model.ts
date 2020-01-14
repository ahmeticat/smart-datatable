export class SmartFilter{
    static filter(data:[],property:string,key:string):any[]{
        return data.filter(a=>(a[`${property}`] as any).toString() === key);
    }
}