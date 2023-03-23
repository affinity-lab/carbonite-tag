import {ModuleManager} from "@affinity-lab/carbonite";
import {DataSource} from "typeorm";
import TagDescriptor from "./tag-descriptor";
import Subscriber from "./subscriber";

let tagModuleManager = new (class extends ModuleManager {
	async initialize(dataSource: DataSource) {
		let atoms = [...(new Set(this.tagDescriptors.map((tagDescriptor: TagDescriptor) => tagDescriptor.atom)))]
		atoms.forEach(atom => {
			let descriptors = this.tagDescriptors.filter(descriptor => descriptor.atom === atom);
			dataSource.subscribers.push(new Subscriber(atom, descriptors))
		});
	}
	private tagDescriptors: Array<TagDescriptor> = [];
	addTagDescriptor(descriptor: TagDescriptor) { this.tagDescriptors.push(descriptor);}
})();

export default tagModuleManager;
