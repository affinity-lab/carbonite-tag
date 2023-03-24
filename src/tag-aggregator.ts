import {Column, In, Like} from "typeorm"

import {Atom} from "@affinity-lab/carbonite";
import {Descriptor} from "./_module";

export default class TagAggregator extends Atom {
	@Column({nullable: false}) tag: string;
	@Column({nullable: true}) group: string;
	static descriptors: Array<Descriptor> = [];
	static addDescriptor(descriptor: Descriptor) {this.descriptors.push(descriptor);}

	static async updateTags(group: string | null) {
		let currentTags = (await this.findTags(group)).map(tag => tag.tag);
		let tags = await this.collectAggregate(group);
		let toRemove = currentTags.filter(tag => !tags.includes(tag));
		let toAdd = tags.filter(tag => !currentTags.includes(tag));

		await this.removeTags(toRemove, group);
		await this.addTags(toAdd, group);
	}

	private static async removeTags(tags: Array<string>, group: string | null = null) { await this.delete({group, tag: In(tags)});}

	private static async addTags(tags: Array<string>, group: string | null = null) {
		for (let tag of tags) await this.create({tag, group}).save();
	}

	public static async renameTag(tag: string, newTag: string | null, group: string | null = null) {
		for (let descriptor of this.descriptors) {
			let table = descriptor.atom.getRepository().metadata.tableName;
			let field = descriptor.property;
			let grouping = descriptor.grouping;
			if (typeof newTag === "string" && newTag.trim() === "") newTag = null;

			if (newTag === null) {
				await this.query(
					`UPDATE ${table} SET ${field} = JSON_REMOVE(${field}, TRIM(BOTH '"' FROM JSON_SEARCH(${field}, 'one', ?)))
					WHERE JSON_CONTAINS(${field}, '"${tag}"', '$')` + (grouping !== null ? ` AND ${grouping} = ?` : ''),
					[tag, group]
				);
			} else {
				await this.query(
					`UPDATE ${table} SET ${field} = JSON_REPLACE(${field}, TRIM(BOTH '"' FROM JSON_SEARCH(${field}, 'one', ?)), ?)
					WHERE JSON_CONTAINS(${field}, '"${tag}"', '$')` + (grouping !== null ? ` AND ${grouping} = ?` : ''),
					[tag, newTag, group]
				);
			}
		}
		await this.updateTags(group);
	}

	public static async removeTag(tag: string, group: string | null = null) {await this.renameTag(tag, null, group);}


	public static async findTags(group: string | null = null, search: string | null = null) {
		let where = {group};
		if (search !== null) where['tag'] = Like(search);
		return await this.find({where});
	}

	private static async collectAggregate(group: string | null) {
		let tags = [];
		for (let descriptor of this.descriptors) {
			let table = descriptor.atom.getRepository().metadata.tableName;
			let field = descriptor.property;
			let grouping = descriptor.grouping;
			let sql = `SELECT DISTINCT __tag_aggregate.tag FROM \`${table}\`, JSON_TABLE(\`${table}\`.\`${field}\`, '$[*]' COLUMNS (tag VARCHAR(255) path '$')) __tag_aggregate`;

			if (grouping === null) {
				tags.push(...await descriptor.atom.query(sql));
			} else {
				tags.push(...await descriptor.atom.query(sql + ` WHERE \`${grouping}\` = ?`, [group]));
			}
		}
		return [...(new Set(tags.map(tag => tag.tag)))];
	}
}