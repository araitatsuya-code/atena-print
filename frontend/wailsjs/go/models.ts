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
	export class ImportResult {
	    total: number;
	    imported: number;
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.imported = source["imported"];
	        this.errors = source["errors"];
	    }
	}
	export class LabelLayout {
	    paperWidth: number;
	    paperHeight: number;
	    labelWidth: number;
	    labelHeight: number;
	    columns: number;
	    rows: number;
	    marginTop: number;
	    marginLeft: number;
	    gapX: number;
	    gapY: number;
	
	    static createFrom(source: any = {}) {
	        return new LabelLayout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.paperWidth = source["paperWidth"];
	        this.paperHeight = source["paperHeight"];
	        this.labelWidth = source["labelWidth"];
	        this.labelHeight = source["labelHeight"];
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.marginTop = source["marginTop"];
	        this.marginLeft = source["marginLeft"];
	        this.gapX = source["gapX"];
	        this.gapY = source["gapY"];
	    }
	}
	export class PostalConfig {
	    x: number;
	    y: number;
	    digitSpacing: number;
	    fontSize: number;
	
	    static createFrom(source: any = {}) {
	        return new PostalConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	        this.digitSpacing = source["digitSpacing"];
	        this.fontSize = source["fontSize"];
	    }
	}
	export class QRConfig {
	    enabled: boolean;
	    content: string;
	    size: number;
	    position: string;
	
	    static createFrom(source: any = {}) {
	        return new QRConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.content = source["content"];
	        this.size = source["size"];
	        this.position = source["position"];
	    }
	}
	export class Sender {
	    id: string;
	    familyName: string;
	    givenName: string;
	    postalCode: string;
	    prefecture: string;
	    city: string;
	    street: string;
	    building: string;
	    company: string;
	    isDefault: boolean;

	    static createFrom(source: any = {}) {
	        return new Sender(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.familyName = source["familyName"];
	        this.givenName = source["givenName"];
	        this.postalCode = source["postalCode"];
	        this.prefecture = source["prefecture"];
	        this.city = source["city"];
	        this.street = source["street"];
	        this.building = source["building"];
	        this.company = source["company"];
	        this.isDefault = source["isDefault"];
	    }
	}
	export class Watermark {
	    id: string;
	    name: string;
	    type: string;
	    filePath: string;
	    opacity: number;
	
	    static createFrom(source: any = {}) {
	        return new Watermark(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.filePath = source["filePath"];
	        this.opacity = source["opacity"];
	    }
	}
	export class TextConfig {
	    nameX: number;
	    nameY: number;
	    nameFont: number;
	    addressX: number;
	    addressY: number;
	    addressFont: number;
	
	    static createFrom(source: any = {}) {
	        return new TextConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nameX = source["nameX"];
	        this.nameY = source["nameY"];
	        this.nameFont = source["nameFont"];
	        this.addressX = source["addressX"];
	        this.addressY = source["addressY"];
	        this.addressFont = source["addressFont"];
	    }
	}
	export class Template {
	    id: string;
	    name: string;
	    orientation: string;
	    labelWidth: number;
	    labelHeight: number;
	    postalCode?: PostalConfig;
	    recipient: TextConfig;
	    sender: TextConfig;
	
	    static createFrom(source: any = {}) {
	        return new Template(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.orientation = source["orientation"];
	        this.labelWidth = source["labelWidth"];
	        this.labelHeight = source["labelHeight"];
	        this.postalCode = this.convertValues(source["postalCode"], PostalConfig);
	        this.recipient = this.convertValues(source["recipient"], TextConfig);
	        this.sender = this.convertValues(source["sender"], TextConfig);
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
	export class PrintJob {
	    contactIds: string[];
	    template: Template;
	    senderId: string;
	    labelLayout: LabelLayout;
	    watermark?: Watermark;
	    qrConfig?: QRConfig;
	
	    static createFrom(source: any = {}) {
	        return new PrintJob(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contactIds = source["contactIds"];
	        this.template = this.convertValues(source["template"], Template);
	        this.senderId = source["senderId"];
	        this.labelLayout = this.convertValues(source["labelLayout"], LabelLayout);
	        this.watermark = this.convertValues(source["watermark"], Watermark);
	        this.qrConfig = this.convertValues(source["qrConfig"], QRConfig);
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

	export class PrintHistory {
	    id: string;
	    printedAt: string;
	    contactCount: number;
	    templateId: string;
	    watermarkId: string;
	    qrEnabled: boolean;

	    static createFrom(source: any = {}) {
	        return new PrintHistory(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.printedAt = source["printedAt"];
	        this.contactCount = source["contactCount"];
	        this.templateId = source["templateId"];
	        this.watermarkId = source["watermarkId"];
	        this.qrEnabled = source["qrEnabled"];
	    }
	}

	export class DashboardStats {
	    contactCount: number;
	    groupCount: number;

	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contactCount = source["contactCount"];
	        this.groupCount = source["groupCount"];
	    }
	}

}

