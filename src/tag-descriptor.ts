import {Atom} from "@affinity-lab/carbonite";
import TagAggregator from "./tag-aggregator";

export default class TagDescriptor {
	constructor(readonly atom: typeof Atom, readonly aggregator: typeof TagAggregator, readonly property:string, readonly grouping: string|null) {}
}