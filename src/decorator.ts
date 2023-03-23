import TagAggregator from "./tag-aggregator";
import {Atom} from "@affinity-lab/carbonite";
import tagModuleManager from "./module-manager";
import TagDescriptor from "./tag-descriptor";

export default function Tag(tagAggregator: typeof TagAggregator, grouping: string | null = null) {
	return function (target: Object, propertyKey: string) {
		tagModuleManager.addTagDescriptor(new TagDescriptor(
			target.constructor as typeof Atom,
			tagAggregator,
			propertyKey,
			grouping
		));
	}
}