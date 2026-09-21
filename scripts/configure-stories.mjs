// Server/admin-only utility. No credentials are imported by Astro.
// Read-only audit by default; --apply requires POCKETBASE_SUPERUSER_TOKEN.
import PocketBase from 'pocketbase';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../src/data/storyIllustrations.json', import.meta.url), 'utf8'));
const corrections = JSON.parse(await readFile(new URL('../src/data/storyOrderCorrections.json', import.meta.url), 'utf8'));
const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
const apply = process.argv.includes('--apply');

async function main() {
	if (!process.env.PUBLIC_POCKETBASE_URL) throw new Error('PUBLIC_POCKETBASE_URL manquant.');
	if (apply) {
		if (!process.env.POCKETBASE_SUPERUSER_TOKEN) throw new Error('POCKETBASE_SUPERUSER_TOKEN requis dans l’environnement du terminal, jamais dans PUBLIC_*.');
		pb.authStore.save(process.env.POCKETBASE_SUPERUSER_TOKEN);
	}
	const pages = await pb.collection('pages_histoires').getFullList({ sort: 'ordre' });
	const existing = new Map(pages.map(page => [page.id, page]));
	for (const [id, item] of Object.entries(config)) {
		const page = existing.get(id);
		if (!page) throw new Error(`Page existante introuvable : ${id}. Aucune écriture effectuée.`);
		for (const placement of item.placements) {
			if (!page.signe_associe?.includes(placement.signe)) throw new Error(`Association à vérifier dans PocketBase : ${id} / ${placement.signe}.`);
		}
	}
	console.log(`${Object.keys(config).length} pages vérifiées ; ${Object.values(config).reduce((count, item) => count + item.placements.length, 0)} placements à configurer. Les fichiers image et vidéo restent dans PocketBase.`);
	console.log('Correction prévue : illustration du ballon en page 16, conformément à la correction de l’auteur.');
	if (!apply) { console.log('Audit seul : aucune donnée modifiée. Ajouter --apply avec un jeton superuser pour appliquer.'); return; }

	// Inspect the real schemas before adding fields. Preserve all existing fields and rules.
	const pageSchema = await pb.collections.getOne('pages_histoires');
	const signSchema = await pb.collections.getOne('signes');
	if (!Array.isArray(pageSchema.fields)) throw new Error('Version PocketBase non compatible : format fields attendu.');
	const addedFields = [
		{ name: 'type_page', type: 'select', maxSelect: 1, values: ['narration', 'recompense'] },
	];
	for (const field of addedFields) {
		const found = pageSchema.fields.find(f => f.name === field.name);
		if (found && found.type !== field.type) throw new Error(`Champ incompatible : ${field.name}`);
	}
	let junction;
	try { junction = await pb.collections.getOne('signes_pages_histoires'); }
	catch (error) { if (error.status !== 404) throw error; }
	const junctionFields = [
		{ name: 'page', type: 'relation', collectionId: pageSchema.id, maxSelect: 1, required: true, cascadeDelete: true },
		{ name: 'signe', type: 'relation', collectionId: signSchema.id, maxSelect: 1, required: true, cascadeDelete: false },
		{ name: 'ordre', type: 'number', min: 0, onlyInt: true },
		...['x', 'y', 'width', 'height'].map(name => ({ name, type: 'number', min: 0, max: 100 })),
	];
	if (junction) {
		for (const expected of junctionFields) {
			const found = junction.fields.find(field => field.name === expected.name);
			if (!found || found.type !== expected.type || (expected.collectionId && found.collectionId !== expected.collectionId)) {
				throw new Error(`Collection de placements existante incompatible : ${expected.name}. Aucune modification du schéma.`);
			}
		}
	}
	const missing = addedFields.filter(field => !pageSchema.fields.some(f => f.name === field.name));
	if (missing.length) await pb.collections.update(pageSchema.id, { fields: [...pageSchema.fields, ...missing] });
	if (!junction) {
		const readRule = '@request.auth.id != "" && (page.histoire.premium = false || @request.auth.abonnement_actif = true)';
		junction = await pb.collections.create({
			name: 'signes_pages_histoires', type: 'base', fields: junctionFields,
			listRule: readRule, viewRule: readRule, createRule: null, updateRule: null, deleteRule: null,
		});
	}
	const links = await pb.collection(junction.id).getFullList();
	for (const [id, item] of Object.entries(config)) {
		// Do not overwrite placements already edited by the author. Safe to re-run after interruption.
		for (let i = 0; i < item.placements.length; i++) {
			const placement = item.placements[i];
			if (!links.some(link => link.page === id && link.signe === placement.signe)) {
				await pb.collection(junction.id).create({ page: id, ordre: i + 1, ...placement });
			}
		}
		const page = existing.get(id);
		const patch = {};
		if (!page.type_page) patch.type_page = item.type ?? 'narration';
		if (Object.keys(patch).length) await pb.collection('pages_histoires').update(id, patch);
	}
	for (const correction of Object.values(corrections)) {
		if (existing.get(correction.trigger)?.ordre !== correction.expectedOrder) continue;
		// Write the trigger last so an interrupted run remains retryable.
		for (const [id, ordre] of Object.entries(correction.orders)) {
			await pb.collection('pages_histoires').update(id, { ordre });
		}
	}
	console.log('Configuration terminée. Aucune vidéo ni collection existante recopiée.');
}

main().catch(error => {
	// Never print the SDK request object: it can include Authorization.
	console.error(`Configuration interrompue : ${error.message}`);
	process.exitCode = 1;
});
