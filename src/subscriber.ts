import {EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent} from "typeorm";
import TagDescriptor from "./tag-descriptor";
import {Atom} from "@affinity-lab/carbonite";

export default class Subscriber implements EntitySubscriberInterface<Atom> {
	readonly tagProperties: Set<string>;
	constructor(readonly atom: typeof Atom, readonly descriptors: Array<TagDescriptor>) {
		this.tagProperties = new Set(descriptors.map(descriptor => descriptor.property));
		descriptors.forEach(descriptor => descriptor.aggregator.addDescriptor(descriptor))
	}
	public listenTo() {return this.atom}
	public async afterRemove(event: RemoveEvent<Atom>): Promise<void> { await this.update(this.tagProperties, event.entity);}
	public async afterInsert(event: InsertEvent<Atom>): Promise<void> { await this.update(this.tagProperties, event.entity);}
	public async afterUpdate(event: UpdateEvent<Atom>) {
		let updatedProperties = new Set(event.updatedColumns.map(column => column.propertyName));
		let updated: Set<string> = new Set([...this.tagProperties].filter(property => updatedProperties.has(property)));
		await this.update(updated, event.entity as Atom)
	}
	private async update(updated: Set<string>, entity: Atom) {
		let descriptors = this.descriptors.filter(descriptor => updated.has(descriptor.property))
		for (let descriptor of descriptors) await descriptor.aggregator.updateTags(descriptor.grouping === null ? null : entity[descriptor.grouping]);
	}
}
