
export class DynamicEnum {
    [x: string]: any;
    private increment = (x: number) => x + 1;
    private parent: DynamicEnum | null = null;
    nextValue: number = 1;

    constructor(items: string[] = [], firstValue?: number, increment?: (x: number) => number) {
        firstValue ? this.nextValue = firstValue : undefined;
        increment ? this.increment = increment : undefined;

        return new Proxy(this, {
            set: (obj, prop: string | number, val) => {
                if (obj[prop] === undefined) {
                    if (items.includes(prop as string))
                        items.forEach(v => this.set(v));

                    this.set(prop, val);
                }
                else if (this.keys.includes(prop as string)) throw new Error("Enum values are immutable");
                else obj[prop] = val;

                return true;
            },
            get: (obj, prop: string | number) => {
                if (obj[prop] === undefined && items.includes(prop as string))
                    items.forEach(v => this.set(v));

                if (obj[prop] === undefined) {
                    let subEnums = obj.values.filter(v => v instanceof DynamicEnum);
                    const checkEnumsFromList = enumList => {
                        for (const v of enumList) {
                            if (Object.keys(v).includes(prop as string)) return v[prop];
                            else {
                                let res = checkEnumsFromList(v.values.filter(v => v instanceof DynamicEnum));
                                if(res) return res;
                            }
                        }
                    }
                    if (subEnums.length > 0) {
                        const result = checkEnumsFromList(subEnums);
                        if (result) return result;
                    }

                    this.set(prop);
                }

                if (obj[prop] instanceof DynamicEnum)
                    obj[prop].nextValue = this.nextValue;

                return obj[prop];
            }
        });
    }

    private setNextValue(val) {
        this.nextValue = val;
        if (this.parent) this.parent.setNextValue(this.nextValue);
    }

    private set(prop, val?) {
        if (typeof prop === "string") {
            if (val !== undefined) {
                if (val instanceof DynamicEnum) {
                    val.parent = this;
                    this[prop] = val;
                } else {
                    this[this[val] = prop] = val;
                    this.setNextValue(this.increment(val));
                }
            } else {
                this[this[this.nextValue] = prop] = this.nextValue;
                this.setNextValue(this.increment(this.nextValue));
            }
        } else this[prop] = val;
    }

    get keys() {
        return Object.keys(this)
            .filter(k => typeof this[k] === "number" && k !== "nextValue"
                || this[k] instanceof DynamicEnum && k !== "parent");
    }

    get values() {
        return this.keys.map(key => this[key]);
    }
}