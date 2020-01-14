export class SmartFilter{
    static filter(data:any[],property:string,key:string):any[]{
        return data.filter(a=>(a[`${property}`] as any).toString().toLocaleLowerCase().includes(key.toLocaleLowerCase()));
    }

    static filterAllProperty(data:any[],key:string):any[]{
        return data.filter(o => Object.keys(o).some(k => o[k].toLowerCase().includes(key.toLowerCase())));
    }
}