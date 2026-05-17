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
	export class AddressNormalizationAddress {
	    prefecture: string;
	    city: string;
	    street: string;
	
	    static createFrom(source: any = {}) {
	        return new AddressNormalizationAddress(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prefecture = source["prefecture"];
	        this.city = source["city"];
	        this.street = source["street"];
	    }
	}
	export class AddressNormalizationApplyResult {
	    batchId?: string;
	    appliedCount: number;
	    skippedCount: number;
	    failedCount: number;
	    errors: string[];
	    canRollback: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AddressNormalizationApplyResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.batchId = source["batchId"];
	        this.appliedCount = source["appliedCount"];
	        this.skippedCount = source["skippedCount"];
	        this.failedCount = source["failedCount"];
	        this.errors = source["errors"];
	        this.canRollback = source["canRollback"];
	    }
	}
	export class AddressNormalizationDiff {
	    field: string;
	    before: string;
	    after: string;
	
	    static createFrom(source: any = {}) {
	        return new AddressNormalizationDiff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.before = source["before"];
	        this.after = source["after"];
	    }
	}
	export class AddressNormalizationCandidate {
	    contactId: string;
	    displayName: string;
	    postalCode: string;
	    before: AddressNormalizationAddress;
	    after: AddressNormalizationAddress;
	    diffs: AddressNormalizationDiff[];
	
	    static createFrom(source: any = {}) {
	        return new AddressNormalizationCandidate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contactId = source["contactId"];
	        this.displayName = source["displayName"];
	        this.postalCode = source["postalCode"];
	        this.before = this.convertValues(source["before"], AddressNormalizationAddress);
	        this.after = this.convertValues(source["after"], AddressNormalizationAddress);
	        this.diffs = this.convertValues(source["diffs"], AddressNormalizationDiff);
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
	
	export class AddressNormalizationPreview {
	    totalContacts: number;
	    convertibleCount: number;
	    candidates: AddressNormalizationCandidate[];
	    canRollback: boolean;
	    rollbackBatchId?: string;
	
	    static createFrom(source: any = {}) {
	        return new AddressNormalizationPreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalContacts = source["totalContacts"];
	        this.convertibleCount = source["convertibleCount"];
	        this.candidates = this.convertValues(source["candidates"], AddressNormalizationCandidate);
	        this.canRollback = source["canRollback"];
	        this.rollbackBatchId = source["rollbackBatchId"];
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
	export class AddressNormalizationRollbackResult {
	    batchId?: string;
	    restoredCount: number;
	    failedCount: number;
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new AddressNormalizationRollbackResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.batchId = source["batchId"];
	        this.restoredCount = source["restoredCount"];
	        this.failedCount = source["failedCount"];
	        this.errors = source["errors"];
	    }
	}
	export class AddressNormalizationSelection {
	    contactId: string;
	    apply: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AddressNormalizationSelection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contactId = source["contactId"];
	        this.apply = source["apply"];
	    }
	}
	export class BackupGeneration {
	    id: string;
	    createdAt: string;
	    contactCount: number;
	    trigger: string;
	
	    static createFrom(source: any = {}) {
	        return new BackupGeneration(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.createdAt = source["createdAt"];
	        this.contactCount = source["contactCount"];
	        this.trigger = source["trigger"];
	    }
	}
	export class BackupTimingSettings {
	    onStartup: boolean;
	    onShutdown: boolean;
	    intervalMinutes: number;
	
	    static createFrom(source: any = {}) {
	        return new BackupTimingSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.onStartup = source["onStartup"];
	        this.onShutdown = source["onShutdown"];
	        this.intervalMinutes = source["intervalMinutes"];
	    }
	}
	export class BackupSettings {
	    timing: BackupTimingSettings;
	    maxGenerations: number;
	
	    static createFrom(source: any = {}) {
	        return new BackupSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timing = this.convertValues(source["timing"], BackupTimingSettings);
	        this.maxGenerations = source["maxGenerations"];
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
	
	export class CSVContactSnapshot {
	    id?: string;
	    displayName: string;
	    postalCode: string;
	    prefecture: string;
	    city: string;
	    street: string;
	    company: string;
	
	    static createFrom(source: any = {}) {
	        return new CSVContactSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.displayName = source["displayName"];
	        this.postalCode = source["postalCode"];
	        this.prefecture = source["prefecture"];
	        this.city = source["city"];
	        this.street = source["street"];
	        this.company = source["company"];
	    }
	}
	export class CSVDuplicateCandidate {
	    rowNumber: number;
	    incoming: CSVContactSnapshot;
	    existing: CSVContactSnapshot;
	    suggestedAction: string;
	
	    static createFrom(source: any = {}) {
	        return new CSVDuplicateCandidate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rowNumber = source["rowNumber"];
	        this.incoming = this.convertValues(source["incoming"], CSVContactSnapshot);
	        this.existing = this.convertValues(source["existing"], CSVContactSnapshot);
	        this.suggestedAction = source["suggestedAction"];
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
	export class CSVDuplicateResolution {
	    rowNumber: number;
	    action: string;
	
	    static createFrom(source: any = {}) {
	        return new CSVDuplicateResolution(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rowNumber = source["rowNumber"];
	        this.action = source["action"];
	    }
	}
	export class CSVImportAnalysis {
	    duplicateRule: string;
	    validRowCount: number;
	    errors: string[];
	    duplicates: CSVDuplicateCandidate[];
	
	    static createFrom(source: any = {}) {
	        return new CSVImportAnalysis(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.duplicateRule = source["duplicateRule"];
	        this.validRowCount = source["validRowCount"];
	        this.errors = source["errors"];
	        this.duplicates = this.convertValues(source["duplicates"], CSVDuplicateCandidate);
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
	export class CSVImportExecutionResult {
	    totalRows: number;
	    created: number;
	    updated: number;
	    skipped: number;
	    duplicateResolved: number;
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new CSVImportExecutionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalRows = source["totalRows"];
	        this.created = source["created"];
	        this.updated = source["updated"];
	        this.skipped = source["skipped"];
	        this.duplicateResolved = source["duplicateResolved"];
	        this.errors = source["errors"];
	    }
	}
	export class CSVImportField {
	    key: string;
	    label: string;
	    required: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CSVImportField(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.required = source["required"];
	    }
	}
	export class CSVImportPlan {
	    headers: string[];
	    sampleRows: string[][];
	    suggestedMapping: Record<string, number>;
	    fieldDefinitions: CSVImportField[];
	    rowCount: number;
	    duplicateRule: string;
	
	    static createFrom(source: any = {}) {
	        return new CSVImportPlan(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.headers = source["headers"];
	        this.sampleRows = source["sampleRows"];
	        this.suggestedMapping = source["suggestedMapping"];
	        this.fieldDefinitions = this.convertValues(source["fieldDefinitions"], CSVImportField);
	        this.rowCount = source["rowCount"];
	        this.duplicateRule = source["duplicateRule"];
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
	export class Contact {
	    id: string;
	    familyName: string;
	    givenName: string;
	    familyNameKana: string;
	    givenNameKana: string;
	    isPrintTarget: boolean;
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
	        this.isPrintTarget = source["isPrintTarget"];
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
	    offsetX: number;
	    offsetY: number;
	
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
	        this.offsetX = source["offsetX"];
	        this.offsetY = source["offsetY"];
	    }
	}
	export class PostalConfig {
	    x: number;
	    y: number;
	    digitSpacing: number;
	    fontSize: number;
	    fontFamily?: string;
	    bold?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PostalConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	        this.digitSpacing = source["digitSpacing"];
	        this.fontSize = source["fontSize"];
	        this.fontFamily = source["fontFamily"];
	        this.bold = source["bold"];
	    }
	}
	export class PrintHistory {
	    id: string;
	    // Go type: time
	    printedAt: any;
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
	        this.printedAt = this.convertValues(source["printedAt"], null);
	        this.contactCount = source["contactCount"];
	        this.templateId = source["templateId"];
	        this.watermarkId = source["watermarkId"];
	        this.qrEnabled = source["qrEnabled"];
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
	    nameFontFamily?: string;
	    nameBold?: boolean;
	    addressX: number;
	    addressY: number;
	    addressFont: number;
	    addressFontFamily?: string;
	    addressBold?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TextConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nameX = source["nameX"];
	        this.nameY = source["nameY"];
	        this.nameFont = source["nameFont"];
	        this.nameFontFamily = source["nameFontFamily"];
	        this.nameBold = source["nameBold"];
	        this.addressX = source["addressX"];
	        this.addressY = source["addressY"];
	        this.addressFont = source["addressFont"];
	        this.addressFontFamily = source["addressFontFamily"];
	        this.addressBold = source["addressBold"];
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
	    labelImageDataURLs?: string[];
	    watermark?: Watermark;
	    qrConfig?: QRConfig;
	    showBorder: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PrintJob(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contactIds = source["contactIds"];
	        this.template = this.convertValues(source["template"], Template);
	        this.senderId = source["senderId"];
	        this.labelLayout = this.convertValues(source["labelLayout"], LabelLayout);
	        this.labelImageDataURLs = source["labelImageDataURLs"];
	        this.watermark = this.convertValues(source["watermark"], Watermark);
	        this.qrConfig = this.convertValues(source["qrConfig"], QRConfig);
	        this.showBorder = source["showBorder"];
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
	
	export class RestoreBackupResult {
	    restored: boolean;
	    backupId: string;
	    preservedBackupId: string;
	    restartRequired: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RestoreBackupResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.restored = source["restored"];
	        this.backupId = source["backupId"];
	        this.preservedBackupId = source["preservedBackupId"];
	        this.restartRequired = source["restartRequired"];
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
	
	
	export class UnsupportedCharacterWarning {
	    contactId: string;
	    contactName: string;
	    characters: string[];
	
	    static createFrom(source: any = {}) {
	        return new UnsupportedCharacterWarning(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contactId = source["contactId"];
	        this.contactName = source["contactName"];
	        this.characters = source["characters"];
	    }
	}

}

