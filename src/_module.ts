import type {EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent} from "typeorm";
import {Atom, ModuleManager} from "@affinity-lab/carbonite";
import type {DataSource} from "typeorm";
import type TagAggregator from "./tag-aggregator";
import type {TransactionCommitEvent} from "typeorm/subscriber/event/TransactionCommitEvent";

let moduleManager = new (class extends ModuleManager {
	async initialize(dataSource: DataSource) {
		let atoms = [...(new Set(this.descriptors.map((tagDescriptor: Descriptor) => tagDescriptor.atom)))]
		atoms.forEach(atom => {
			let descriptors = this.descriptors.filter(descriptor => descriptor.atom === atom);
			dataSource.subscribers.push(new Subscriber(atom, descriptors))
		});
	}
	private descriptors: Array<Descriptor> = [];
	addDescriptor(descriptor: Descriptor) { this.descriptors.push(descriptor);}
})();


export default function Tag(tagAggregator: typeof TagAggregator, grouping: string | null = null) {
	return function (target: Object, propertyKey: string) {
		moduleManager.addDescriptor(new Descriptor(
			target.constructor as typeof Atom,
			tagAggregator,
			propertyKey,
			grouping
		));
	}
}

export class Descriptor {
	constructor(
		readonly atom: typeof Atom,
		readonly aggregator: typeof TagAggregator,
		readonly property:string,
		readonly grouping: string|null) {}
}

class Subscriber implements EntitySubscriberInterface<Atom> {
	readonly tagProperties: Set<string>;
	constructor(readonly atom: typeof Atom, readonly descriptors: Array<Descriptor>) {
		this.tagProperties = new Set(descriptors.map(descriptor => descriptor.property));
		descriptors.forEach(descriptor => descriptor.aggregator.addDescriptor(descriptor))
	}
	public listenTo() {return this.atom}

	private queue:Array<{descriptors: Descriptor[], entity: Atom}> = [];

	public async afterTransactionCommit(event: TransactionCommitEvent){
		while (this.queue.length>0){
			let q = this.queue.pop();
			for (let descriptor of q.descriptors) await descriptor.aggregator.updateTags(descriptor.grouping === null ? null : q.entity[descriptor.grouping]);
		}
	}

	public async afterRemove(event: RemoveEvent<Atom>): Promise<void> { await this.update(this.tagProperties, event.entity);}
	public async afterInsert(event: InsertEvent<Atom>): Promise<void> { await this.update(this.tagProperties, event.entity);}
	public async afterUpdate(event: UpdateEvent<Atom>) {
		let updatedProperties = new Set(event.updatedColumns.map(column => column.propertyName));
		let updated: Set<string> = new Set([...this.tagProperties].filter(property => updatedProperties.has(property)));
		await this.update(updated, event.entity as Atom)
	}
	private async update(updated: Set<string>, entity: Atom) {
		let descriptors = this.descriptors.filter(descriptor => updated.has(descriptor.property));
		this.queue.push({descriptors, entity})
	}
}