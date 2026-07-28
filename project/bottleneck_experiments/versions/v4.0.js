import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v4.0',
  title: 'AWS RDS 이전 및 DB 접근 구조 개선',
  status: 'shipped',
  tags: ['AWS RDS', 'ALB', 'asyncpg', 'OpenAI Rate Limit'],
  prev: '3.2',
  next: '4.1',

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text([
        'Supabase의 DB 기능을 AWS RDS로 이전하고, Supabase에서는 Auth/Storage만 유지하도록 변경하였습니다.',
        '이에 따라 ALB 및 ECS API Server를 도입하여 Vercel에서 Private RDS에 안전하게 접근할 수 있는 구조로 구성하였습니다.',
        '또한 AI-Worker는 supabase-py에서 asyncpg 기반으로 변경하고 Transaction Pooler를 적용하였습니다.',
      ])}
      ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-diagram.png', 'v4.0 아키텍처 다이어그램')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text([
        '이전 부하 테스트 결과, Supabase에 의존하던 기능들을 분리하여 독립적으로 운영해야할 필요성을 확인했습니다. 따라서 Auth와 Storage 기능만 Supabase에 유지하고, Database는 AWS RDS로 이전하기로 결정하였습니다.',
        '이 때 RDS는 보안을 위해 private subnet으로 배치하였습니다. 하지만 Vercel은 고정 IP가 없는 서버리스 환경이기 때문에 Private Subnet에 위치한 RDS에 직접 접근할 수 없었습니다. RDS Proxy를 사용하는 방법도 고려하였지만 해당 기능은 프리티어에서는 지원하지 않는다는 문제가 있었습니다. 따라서 새 서비스 추가 비용을 최소로 하기 위해, 이미 rule-worker와 ai-worker가 돌아가고 있는 ECS에 api-server 서비스를 추가하였습니다. 이때 해당 서비스는 기존 FE 프로젝트와 동일한 TypeScript 기반으로 구현하여 개발 효율과 유지보수가 용이하도록 했으며, API 전용 서버이므로 Express를 사용하여 구현하였습니다.',
        '또한 ECS Fargate 환경에서는 task가 재배포되거나 Auto Scaling이 수행될 경우 IP가 변경될 수 있으므로 외부에서 접근 가능한 고정 진입점이 필요했습니다. 또한 HTTPS 적용을 위해서는 인증서를 발급해야만 했습니다. Let\'s Encrypt와 같은 무료 SSL 인증서를 발급할 수도 있었지만 개발 및 운영 복잡도가 증가하게 되는 반면, ACM을 사용하면 ALB와 같이 사용시 인증서를 자동으로 발급, 갱신, 교체해줘 운영 부담이 적기 때문에 ACM, ALB를 사용하기로 결정했습니다.',
        '그에 따라 ALB와 ACM을 통해 api-server를 고정된 HTTPS 엔드포인트로 외부에 제공할 수 있게 되었으며, 인증서의 발급과 갱신을 AWS에서 자동적으로 관리하게 되므로 운영의 부담 역시 줄일 수 있었습니다.',
        '또한 ai-worker 역시 rule-worker와 같이 기존 supabase-py를 통한 접근 대신 asyncpg 기반으로 RDS에 직접 연결할 수 있도록 변경하였습니다. 또한 Transaction Pooler를 적용해 제한된 PostgreSQL Connection을 효율적으로 사용할 수 있도록 하였습니다.',
      ])}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text('데이터베이스를 AWS RDS로 이전하고 ai-worker의 DB 접근 방식(asyncpg + Transaction Pooler)을 제외한 모든 실험 조건은 이전 버전과 동일하게 유지하여 부하테스트를 수행하였습니다.')}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '2.10', '3.19', '0%'] },
            { cells: ['2', '1.42', '1.98', '0%'] },
            { cells: ['3', '1.15', '1.67', '0%'] },
            { cells: ['4', '1.13', '1.67', '0%'] },
            { cells: ['5', '0.81', '1.05', '0%'] },
            { cells: ['6', '1.01', '1.20', '0%'] },
            { cells: ['7', '0.90', '1.05', '0%'] },
            { cells: ['8', '0.89', '1.18', '0%'] },
            { cells: ['9', '1.06', '1.28', '0%'] },
            { cells: ['10', '0.84', '1.02', '0%'] },
            { cells: ['평균 (2~10회)', '1.02', '1.34', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1회차를 cold start로 추정하여 제외하였습니다. 데이터가 안정된 2~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('애플리케이션 지표', `
          ${table({
            head: ['지표', '결과'],
            rows: [
              { cells: ['avg', '0.83'] },
              { cells: ['p95', '1.21'] },
              { cells: ['에러율', '0%'] },
            ]
          })}
          <div style="margin-top:20px;">
            ${table({
              head: ['VU', 'avg', 'p95', '상태'],
              rows: [
                { cells: ['0→10', '1.02', '1.87', '안정'] },
                { cells: ['10', '0.88', '1.47', '안정'] },
                { cells: ['30', '0.84', '1.21', '안정'], highlight: true },
                { cells: ['50', '0.83', '1.20', '안정'] },
                { cells: ['100', '0.82', '1.94', '안정'] },
              ]
            })}
          </div>
          <p class="body-text" style="margin-top:12px;">100VU 전 구간에서 안정상태였으며 임계점 대비 40% 수준에서도 에러율 0%로 확인되었습니다.</p>
        `)}
        ${badge('event-queue', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-event-queue-sent-deleted.png', 'event-queue Sent/Deleted 그래프')}
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-event-queue-oldest.png', 'event-queue Approximate Age Of Oldest Message 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-event-queue-task-count.png', 'event-queue Task Count 그래프')}
          </div>
          <p class="body-text" style="margin-top:12px;">50VU 구간까지 Number Of Messages Sent와 Number Of Messages Deleted가 거의 동일하게 유지되며, 100VU 구간부터 격차가 발생하기 시작했습니다. 또한 전 구간에서 Approximate Age Of Oldest Message는 최대 1분 이내로 유지되었으며, rule-worker live task count를 확인한 결과 테스트 구간 대부분에서는 task 1개로 유지되다가 부하가 종료되는 시점에 근접했을 때 scale-out이 발생했습니다.</p>
        `)}
        ${badge('rule-worker 관련 cloudwatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-rule-worker-cpu-memory.png', 'rule-worker CPU/Memory 그래프')}
          <p class="body-text" style="margin-top:12px;">rule-worker의 CPU Utilization은 VU 증가에 따라 단계적으로 상승하였으며, 100VU 구간에서는 100%에 근접하였습니다.</p>
        `)}
        ${badge('ai-queue', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-ai-queue-sent-deleted.png', 'ai-queue Sent/Deleted 그래프')}
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-ai-queue-oldest.png', 'ai-queue Approximate Age Of Oldest Message 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-ai-queue-visible.png', 'ai-queue Approximate Number Of Messages Visible 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-ai-queue-task-count.png', 'ai-queue Task Count 그래프')}
          </div>
          <p class="body-text" style="margin-top:12px;">부하가 지속됨에 따라 Number Of Messages Sent와 Number Of Messages Deleted간 격차가 지속적으로 확대되는 것을 확인할 수 있었습니다. 또한 Approximate Age Of Oldest Message는 최대 10.5분까지 증가했으며 Approximate Number Of Messages Visible가 최대 8030건까지 선형적으로 증가했습니다. Live Task Count 확인 결과 4개, 7개, 10개로 단계적으로 확장되는 것을 확인할 수 있었습니다.</p>
        `)}
        ${badge('ai-worker 관련 cloudwatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-ai-worker-cpu-memory.png', 'ai-worker CPU/Memory 그래프')}
          <p class="body-text" style="margin-top:12px;">CPU Utilization은 최대 58.9% 수준에 머무르는 것으로 확인되었습니다.</p>
        `)}
      `)}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${subLabel('분석 1 : Rule-worker 처리 구조', `
        ${text([
          '50VU까지는 event-queue의 Number Of Messages Sent와 Number Of Messages Deleted가 거의 동일하게 유지되었다는 점을 통해 단일 Rule-worker Task만으로도 부하를 충분히 처리할 수 있다는 것을 확인하였습니다. 하지만 100VU 구간에서는 두 지표 간 격차가 발생하기 시작했고, CPU Utilization도 100%에 근접했는데도 Scale-out이 부하 종료 시점에 가까워져서야 수행되었습니다.',
          '이를 통해 SQS Visible Message만을 기준으로 한 현재 Auto Scaling 정책은 초기 부하 변화에 대한 반응이 다소 늦은 것으로 판단하였고, 이에 따라 CPU Utilization과 같은 리소스 지표를 함께 활용하는 방식도 고려해보아야겠다 판단하였습니다.',
        ])}
      `)}
      ${subLabel('분석 2 : ai-worker 처리량', `
        ${text([
          'AI-worker는 부하가 증가함에 따라 Approximate Age Of Oldest Message가 최대 10.5분까지 증가하였으며, Approximate Number Of Messages Visible도 107건에서 최대 8,030건까지 지속적으로 증가하였습니다. 이를 통해 메시지 유입 속도가 처리 속도를 지속적으로 상회하여 Queue에 Backlog가 누적되고 있다고 판단하였습니다.',
          '또한 Worker를 4개, 7개, 10개까지 단계적으로 확장시 4개에서는 처리량 증가 효과가 미미하였고 7개에서만 일시적으로 처리량이 유지되었습니다. 반면 10개에서는 오히려 Number Of Messages Sent와 Number Of Messages Deleted가 감소했으며 CPU Utilization은 최대 58.9% 수준으로 여유가 있었으므로 ECS 리소스 자체가 병목은 아니라고 판단하였습니다.',
        ])}
      `)}
      ${subLabel('분석 3 : OpenAI Rate limit', `
        ${imageUrl('../../assets/images/bottleneck_experiments/v7/v7-tpm.png', 'OpenAI TPM/RPM/RPD 사용량 그래프')}
        <div style="margin-top:20px;">
          ${text([
            'CloudWatch Logs Insights 분석 결과 OpenAI RateLimitError(HTTP 429)가 총 3,710건 발생하는 것을 확인했습니다. 또한 로그에는 TPM(1,522건), RPM(1,184건), RPD(1,004건) 제한 초과가 모두 포함되어 있었습니다.',
            '이를 통해 Worker를 확장하더라도 외부 LLM API의 사용량 제한으로 인해 처리량이 증가하지 않았음을 확인하였습니다.',
          ])}
        </div>
      `)}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text('Rule-worker는 Auto Scaling 정책을 개선하여 초기 부하에 더 빠르게 대응할 수 있도록 하고, AI-worker는 OpenAI API의 Rate Limit을 고려한 Concurrency 제어를 적용하는 방향으로 개선하기로 결정했습니다. 다만 현재 사용 중인 OpenAI Tier에서는 처리량을 추가로 높이는 데 한계가 있다고 판단하였습니다. 하지만 비용을 고려해 Tier 업그레이드는 수행하지 않기로 했습니다.')}
    `),
  ]
};
