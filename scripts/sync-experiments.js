import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const dataDir = path.join(__dirname, '../data/experiments');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

for (const file of files) {
	  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
	  
	  await sql`
	      insert into experiments (
	            id, title, hypothesis, status, validation,
		          result_metrics, primary_metric_name, primary_metric_value,
			        conclusion, problem_found, improvement,
				      github_doc_url, diagram_url, arch_version, tags,
				            started_at, ended_at
					        ) values (
						      ${data.id},
						            ${data.title},
							          ${data.hypothesis},
								        ${data.status || 'draft'},
									      ${data.validation || null},
									            ${data.result_metrics ? JSON.stringify(data.result_metrics) : null},
										          ${data.primary_metric_name || null},
											        ${data.primary_metric_value || null},
												      ${data.conclusion || null},
												            ${data.problem_found || null},
													          ${data.improvement || null},
														        ${data.github_doc_url},
															      ${data.diagram_url || null},
															            ${data.arch_version || null},
																          ${data.tags || []},
																	        ${data.started_at},
																		      ${data.ended_at || null}
																		          )
																			      on conflict (id) do update set
																			            title = excluded.title,
																				          hypothesis = excluded.hypothesis,
																					        status = excluded.status,
																						      validation = excluded.validation,
																						            result_metrics = excluded.result_metrics,
																							          primary_metric_name = excluded.primary_metric_name,
																								        primary_metric_value = excluded.primary_metric_value,
																									      conclusion = excluded.conclusion,
																									            problem_found = excluded.problem_found,
																										          improvement = excluded.improvement,
																											        github_doc_url = excluded.github_doc_url,
																												      diagram_url = excluded.diagram_url,
																												            arch_version = excluded.arch_version,
																													          tags = excluded.tags,
																														        started_at = excluded.started_at,
																															      ended_at = excluded.ended_at
																															        `;
	  console.log(`✅ ${data.id} synced`);
}

await sql.end();
console.log('Done!');
