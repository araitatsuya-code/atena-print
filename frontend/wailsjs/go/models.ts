export namespace entity {

	export class Address {
	    prefecture: string;
	    city: string;
	    town: string;

	    static createFrom(source: any = {}) {
	        return new Address(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prefecture = source["prefecture"];
	        this.city = source["city"];
	        this.town = source["town"];
	    }
	}

	export class Contact {
	    id: string;
	    familyName: string;
	    givenName: string;
	    familyNameKana: string;
	    givenNameKana: string;
	    honorific: string;
	    postalCode: string;
	    prefecture: string;
	    city: string;
	    street: string;
	    building: string;
	    company: string;
	    department: string;
	    notes: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Contact(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.familyName = source["familyName"];
	        this.givenName = source["givenName"];
	        this.familyNameKana = source["familyNameKana"];
	        this.givenNameKana = source["givenNameKana"];
	        this.honorific = source["honorific"];
	        this.postalCode = source["postalCode"];
	        this.prefecture = source["prefecture"];
	        this.city = source["city"];
	        this.street = source["street"];
	        this.building = source["building"];
	        this.company = source["company"];
	        this.department = source["department"];
	        this.notes = source["notes"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class Group {
	    id: string;
	    name: string;

	    static createFrom(source: any = {}) {
	        return new Group(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}

}

