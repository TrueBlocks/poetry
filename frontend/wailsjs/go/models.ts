export namespace database {
	
	export class Cliche {
	    clicheId: number;
	    phrase: string;
	    definition?: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Cliche(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clicheId = source["clicheId"];
	        this.phrase = source["phrase"];
	        this.definition = source["definition"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
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
	    totalItems: number;
	    totalLinks: number;
	    quoteCount: number;
	    citedCount: number;
	    writerCount: number;
	    poetCount: number;
	    titleCount: number;
	    wordCount: number;
	    errorCount: number;
	
	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalItems = source["totalItems"];
	        this.totalLinks = source["totalLinks"];
	        this.quoteCount = source["quoteCount"];
	        this.citedCount = source["citedCount"];
	        this.writerCount = source["writerCount"];
	        this.poetCount = source["poetCount"];
	        this.titleCount = source["titleCount"];
	        this.wordCount = source["wordCount"];
	        this.errorCount = source["errorCount"];
	    }
	}
	export class Link {
	    linkId: number;
	    sourceItemId: number;
	    destinationItemId: number;
	    linkType: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Link(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.linkId = source["linkId"];
	        this.sourceItemId = source["sourceItemId"];
	        this.destinationItemId = source["destinationItemId"];
	        this.linkType = source["linkType"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
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
	export class Item {
	    itemId: number;
	    word: string;
	    type: string;
	    definition?: string;
	    parsedDefinition?: parser.Segment[];
	    derivation?: string;
	    appendicies?: string;
	    source?: string;
	    sourcePg?: string;
	    mark?: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    modifiedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Item(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	        this.definition = source["definition"];
	        this.parsedDefinition = this.convertValues(source["parsedDefinition"], parser.Segment);
	        this.derivation = source["derivation"];
	        this.appendicies = source["appendicies"];
	        this.source = source["source"];
	        this.sourcePg = source["sourcePg"];
	        this.mark = source["mark"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.modifiedAt = this.convertValues(source["modifiedAt"], null);
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
	export class GraphData {
	    items: Item[];
	    links: Link[];
	
	    static createFrom(source: any = {}) {
	        return new GraphData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Item);
	        this.links = this.convertValues(source["links"], Link);
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
	export class HubItem {
	    itemId: number;
	    word: string;
	    linkCount: number;
	    mark?: string;
	
	    static createFrom(source: any = {}) {
	        return new HubItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.linkCount = source["linkCount"];
	        this.mark = source["mark"];
	    }
	}
	
	
	export class LiteraryTerm {
	    termId: number;
	    term: string;
	    type?: string;
	    definition?: string;
	    examples?: string;
	    notes?: string;
	    // Go type: time
	    createdAt: any;
	    existsInItems: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LiteraryTerm(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.termId = source["termId"];
	        this.term = source["term"];
	        this.type = source["type"];
	        this.definition = source["definition"];
	        this.examples = source["examples"];
	        this.notes = source["notes"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.existsInItems = source["existsInItems"];
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
	export class Name {
	    nameId: number;
	    name: string;
	    type?: string;
	    gender?: string;
	    description?: string;
	    notes?: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Name(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nameId = source["nameId"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.gender = source["gender"];
	        this.description = source["description"];
	        this.notes = source["notes"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
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
	export class SearchOptions {
	    query: string;
	    types: string[];
	    source: string;
	    useRegex: boolean;
	    caseSensitive: boolean;
	    hasImage: boolean;
	    hasTts: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SearchOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.types = source["types"];
	        this.source = source["source"];
	        this.useRegex = source["useRegex"];
	        this.caseSensitive = source["caseSensitive"];
	        this.hasImage = source["hasImage"];
	        this.hasTts = source["hasTts"];
	    }
	}
	export class Source {
	    sourceId: number;
	    title: string;
	    author?: string;
	    notes?: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Source(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceId = source["sourceId"];
	        this.title = source["title"];
	        this.author = source["author"];
	        this.notes = source["notes"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
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

}

export namespace main {
	
	export class Capabilities {
	    hasTts: boolean;
	    hasImages: boolean;
	    hasAi: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Capabilities(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasTts = source["hasTts"];
	        this.hasImages = source["hasImages"];
	        this.hasAi = source["hasAi"];
	    }
	}
	export class ImageCacheInfo {
	    fileCount: number;
	    totalSize: number;
	
	    static createFrom(source: any = {}) {
	        return new ImageCacheInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fileCount = source["fileCount"];
	        this.totalSize = source["totalSize"];
	    }
	}
	export class TTSCacheInfo {
	    fileCount: number;
	    totalSize: number;
	
	    static createFrom(source: any = {}) {
	        return new TTSCacheInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fileCount = source["fileCount"];
	        this.totalSize = source["totalSize"];
	    }
	}

}

export namespace parser {
	
	export class Token {
	    type: string;
	    content: string;
	    refType?: string;
	    refWord?: string;
	    displayWord?: string;
	
	    static createFrom(source: any = {}) {
	        return new Token(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	        this.refType = source["refType"];
	        this.refWord = source["refWord"];
	        this.displayWord = source["displayWord"];
	    }
	}
	export class Segment {
	    type: string;
	    content: string;
	    preText?: string;
	    postText?: string;
	    tokens?: Token[];
	    preTokens?: Token[];
	    postTokens?: Token[];
	
	    static createFrom(source: any = {}) {
	        return new Segment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	        this.preText = source["preText"];
	        this.postText = source["postText"];
	        this.tokens = this.convertValues(source["tokens"], Token);
	        this.preTokens = this.convertValues(source["preTokens"], Token);
	        this.postTokens = this.convertValues(source["postTokens"], Token);
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

}

export namespace services {
	
	export class DanglingLinkResult {
	    linkId: number;
	    sourceItemId: number;
	    destinationItemId: number;
	    linkType: string;
	    sourceWord: string;
	    sourceType: string;
	    missingSide: string;
	
	    static createFrom(source: any = {}) {
	        return new DanglingLinkResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.linkId = source["linkId"];
	        this.sourceItemId = source["sourceItemId"];
	        this.destinationItemId = source["destinationItemId"];
	        this.linkType = source["linkType"];
	        this.sourceWord = source["sourceWord"];
	        this.sourceType = source["sourceType"];
	        this.missingSide = source["missingSide"];
	    }
	}
	export class DuplicateItemDetail {
	    itemId: number;
	    word: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new DuplicateItemDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	    }
	}
	export class DuplicateItemResult {
	    strippedWord: string;
	    original: DuplicateItemDetail;
	    duplicates: DuplicateItemDetail[];
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new DuplicateItemResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.strippedWord = source["strippedWord"];
	        this.original = this.convertValues(source["original"], DuplicateItemDetail);
	        this.duplicates = this.convertValues(source["duplicates"], DuplicateItemDetail);
	        this.count = source["count"];
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
	export class ItemWithUnknownTypeResult {
	    itemId: number;
	    word: string;
	    type: string;
	    incomingLinkCount: number;
	    singleIncomingLinkItemId?: number;
	    singleIncomingLinkWord?: string;
	
	    static createFrom(source: any = {}) {
	        return new ItemWithUnknownTypeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	        this.incomingLinkCount = source["incomingLinkCount"];
	        this.singleIncomingLinkItemId = source["singleIncomingLinkItemId"];
	        this.singleIncomingLinkWord = source["singleIncomingLinkWord"];
	    }
	}
	export class ItemWithoutDefinitionResult {
	    itemId: number;
	    word: string;
	    type: string;
	    hasMissingData: boolean;
	    singleIncomingLinkItemId?: number;
	    singleIncomingLinkWord?: string;
	
	    static createFrom(source: any = {}) {
	        return new ItemWithoutDefinitionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	        this.hasMissingData = source["hasMissingData"];
	        this.singleIncomingLinkItemId = source["singleIncomingLinkItemId"];
	        this.singleIncomingLinkWord = source["singleIncomingLinkWord"];
	    }
	}
	export class LinkOrTagResult {
	    linkCreated: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new LinkOrTagResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.linkCreated = source["linkCreated"];
	        this.message = source["message"];
	    }
	}
	export class LinkedItemNotInDefinitionResult {
	    itemId: number;
	    word: string;
	    type: string;
	    missingReferences: string[];
	
	    static createFrom(source: any = {}) {
	        return new LinkedItemNotInDefinitionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	        this.missingReferences = source["missingReferences"];
	    }
	}
	export class OrphanedItemResult {
	    itemId: number;
	    word: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new OrphanedItemResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	    }
	}
	export class SelfReferenceResult {
	    itemId: number;
	    word: string;
	    type: string;
	    tag: string;
	
	    static createFrom(source: any = {}) {
	        return new SelfReferenceResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	        this.tag = source["tag"];
	    }
	}
	export class TTSResult {
	    audioData: number[];
	    cached: boolean;
	    error: string;
	    errorType: string;
	
	    static createFrom(source: any = {}) {
	        return new TTSResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.audioData = source["audioData"];
	        this.cached = source["cached"];
	        this.error = source["error"];
	        this.errorType = source["errorType"];
	    }
	}
	export class UnknownTagResult {
	    itemId: number;
	    word: string;
	    type: string;
	    unknownTags: string[];
	    tagCount: number;
	
	    static createFrom(source: any = {}) {
	        return new UnknownTagResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	        this.unknownTags = source["unknownTags"];
	        this.tagCount = source["tagCount"];
	    }
	}
	export class UnlinkedReferenceDetail {
	    ref: string;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new UnlinkedReferenceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ref = source["ref"];
	        this.reason = source["reason"];
	    }
	}
	export class UnlinkedReferenceResult {
	    itemId: number;
	    word: string;
	    type: string;
	    unlinkedRefs: UnlinkedReferenceDetail[];
	    refCount: number;
	
	    static createFrom(source: any = {}) {
	        return new UnlinkedReferenceResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.word = source["word"];
	        this.type = source["type"];
	        this.unlinkedRefs = this.convertValues(source["unlinkedRefs"], UnlinkedReferenceDetail);
	        this.refCount = source["refCount"];
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

}

export namespace settings {
	
	export class CollapsedState {
	    outgoing: boolean;
	    incoming: boolean;
	    linkIntegrity: boolean;
	    itemHealth: boolean;
	    recentPath: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CollapsedState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.outgoing = source["outgoing"];
	        this.incoming = source["incoming"];
	        this.linkIntegrity = source["linkIntegrity"];
	        this.itemHealth = source["itemHealth"];
	        this.recentPath = source["recentPath"];
	    }
	}
	export class SavedSearch {
	    name: string;
	    query: string;
	    types?: string[];
	    source?: string;
	
	    static createFrom(source: any = {}) {
	        return new SavedSearch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.query = source["query"];
	        this.types = source["types"];
	        this.source = source["source"];
	    }
	}
	export class TableSort {
	    field1?: string;
	    dir1?: string;
	    field2?: string;
	    dir2?: string;
	
	    static createFrom(source: any = {}) {
	        return new TableSort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field1 = source["field1"];
	        this.dir1 = source["dir1"];
	        this.field2 = source["field2"];
	        this.dir2 = source["dir2"];
	    }
	}
	export class Window {
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	    leftbarWidth: number;
	
	    static createFrom(source: any = {}) {
	        return new Window(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.leftbarWidth = source["leftbarWidth"];
	    }
	}
	export class Settings {
	    window: Window;
	    exportFolder: string;
	    lastWordId: number;
	    lastView: string;
	    lastTable: string;
	    tabSelections: Record<string, string>;
	    revealMarkdown: boolean;
	    showMarked: boolean;
	    collapsed: CollapsedState;
	    tableSorts?: Record<string, TableSort>;
	    currentSearch: string;
	    managerOldType: string;
	    managerNewType: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.window = this.convertValues(source["window"], Window);
	        this.exportFolder = source["exportFolder"];
	        this.lastWordId = source["lastWordId"];
	        this.lastView = source["lastView"];
	        this.lastTable = source["lastTable"];
	        this.tabSelections = source["tabSelections"];
	        this.revealMarkdown = source["revealMarkdown"];
	        this.showMarked = source["showMarked"];
	        this.collapsed = this.convertValues(source["collapsed"], CollapsedState);
	        this.tableSorts = this.convertValues(source["tableSorts"], TableSort, true);
	        this.currentSearch = source["currentSearch"];
	        this.managerOldType = source["managerOldType"];
	        this.managerNewType = source["managerNewType"];
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
	

}

