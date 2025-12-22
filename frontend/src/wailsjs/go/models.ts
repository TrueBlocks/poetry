/* eslint-disable @typescript-eslint/no-namespace */
export namespace database {
  export class Item {
    itemId: number;
    word: string;
    type: string;
    definition?: string;
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
      if ("string" === typeof source) source = JSON.parse(source);
      this.itemId = source["itemId"];
      this.word = source["word"];
      this.type = source["type"];
      this.definition = source["definition"];
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
        return (a as any[]).map((elem) => this.convertValues(elem, classs));
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
      if ("string" === typeof source) source = JSON.parse(source);
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
        return (a as any[]).map((elem) => this.convertValues(elem, classs));
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
