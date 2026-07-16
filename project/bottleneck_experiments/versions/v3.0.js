import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip } from '../components/render.js';

const TOOLTIP_ARCHITECTURE = `해당 버전부터는 Queue와 Worker의 역할을 명확히 구분하기 위해 용어를 통일하였습니다.<br><br>- <strong>event-queue</strong> : API에서 이벤트를 입력받는 Queue<br>- <strong>ai-queue</strong> : LLM 처리 요청을 담당하는 Queue<br><br>- <strong>rule-worker</strong> : event-queue의 이벤트를 처리하고 LLM 호출 여부를 판단하는 서비스<br>- <strong>ai-worker</strong> : ai-queue의 요청을 처리하여 LLM을 호출하는 서비스`;

export default {
  version: 'v3.0',
  title: 'Realtime 기반 이벤트 트리거 제거 및 Queue 기반 이벤트 처리 구조 도입',
  status: 'shipped',
  tags: ['Supabase Realtime', 'SQS'],
  prev: '2.0',
  next: '3.1',

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text([
        '이벤트 전달 방식을 Supabase Realtime에서 Queue 기반으로 변경하였습니다.',
        '기존에는 Supabase Realtime이 DB의 입력 데이터를 감지하여 Worker를 실행했지만, API 서버가 DB 저장 이후 Queue (event-queue)에 직접 이벤트를 발행하도록 변경하여 DB는 데이터 저장 역할에 집중할 수 있게 되었습니다.',
        '이에 따라 DB에는 저장되었지만 Queue에는 전달되지 않는 상황이 발생할 수 있으므로, 이벤트의 처리 상태를 관리할 수 있도록 processed 컬럼을 status 컬럼으로 변경하고 누락된 데이터를 다시 Queue(event-queue)로 전달하는 fallback worker를 추가하였습니다.',
        '또한 메시지 처리에 실패하더라도 데이터가 유실되지 않도록 각 Queue에 DLQ(Dead Letter Queue) 를 추가하였습니다.',
      ])}
      ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-diagram.png', 'v3.0 아키텍처 다이어그램')}
      <div style="text-align:left; margin-top:8px;">${tooltip(TOOLTIP_ARCHITECTURE)}</div>
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text([
        '이전 버전에서 결정한 개선 방향에 따라 Supabase Realtime 기반 트리거를 제거하고 이벤트를 메시지 큐로 전달하는 구조를 설계하였습니다.',
        '이벤트를 Queue로 전달하는 방식으로는 API 서버에서 직접 Queue에 이벤트를 전달하는 방식과 DB 트리거를 통해 Queue로 이벤트 전달하는 방식을 고려하였습니다.',
        'DB trigger는 이벤트 흐름이 DB 내부에 포함되어 장애 원인 추적과 운영이 복잡해질 수 있다고 판단하였습니다. 반면 API 서버에서 직접 Queue에 이벤트를 전달하는 방식은 이벤트 생성 시점을 애플리케이션에서 명확히 관리가 가능하며, 실패시 재시도와 로깅 등을 유연하게 구현 가능해 해당 방식을 선택하였습니다.',
      ])}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text([
        '아키텍처를 제외한 모든 실험 조건은 이전 버전과 동일하게 유지하여 부하 테스트를 수행했습니다.',
      ])}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '1.68', '2.03', '0%'] },
            { cells: ['2', '1.01', '1.18', '0%'] },
            { cells: ['3', '0.96', '0.99', '0%'] },
            { cells: ['4', '1.25', '1.64', '0%'] },
            { cells: ['5', '0.98', '1.18', '0%'] },
            { cells: ['6', '1.05', '1.18', '0%'] },
            { cells: ['7', '0.92', '1.01', '0%'] },
            { cells: ['8', '1.20', '1.35', '0%'] },
            { cells: ['9', '0.91', '0.99', '0%'] },
            { cells: ['10', '1.00', '1.16', '0%'] },
            { cells: ['평균 (2~10회)', '1.03', '1.19', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1회차를 cold start로 추정하여 제외하였습니다. 데이터가 안정된 2~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('event-queue', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-event-queue-sent.png', 'event-queue Number Of Messages Sent 그래프')}
          ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-event-queue-visible.png', 'event-queue Approximate Number Of Messages Visible 그래프')}
          ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-event-queue-notvisiblepng.png', 'event-queue Approximate Number Of Messages Not Visible 그래프')}
          <p class="body-text" style="margin-top:12px;">부하가 증가함에 따라 SQS Backlog는 급격히 증가한 반면, Approximate Number Of Messages Not Visible 값은 테스트 동안 1 수준을 유지하였습니다.</p>
        `)}
        ${badge('ai-queue', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-ai-queue-visible.png', 'ai-queue Approximate Number Of Messages Visible 그래프')}
          ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-ai-queue-ecstask.png', 'ai-queue ECS Task 그래프')}
          <p class="body-text" style="margin-top:12px;">Approximate Number Of Messages Visible 값이 테스트(15:45 ~ 15:59) 동안 최대 1194건까지 지속적으로 증가하였습니다.</p>
          <p class="body-text" style="margin-top:12px;">ECS Running Task Count는 테스트 동안 변화가 없었으며, 테스트 종료 이후 AI Queue Backlog가 Auto Scaling 임계값(1440건)을 초과하면서 Scale-out이 발생했습니다.</p>
        `)}
      `)}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${text([
        'Event Queue의 Backlog 증가와 ApproximateNumberOfMessagesNotVisible 값이 1 수준으로 유지된 것을 통해 Rule Worker 처리량 부족을 확인하였습니다.',
        '확인 결과 rule-worker는 단일 프로세스로 동작하고 있어 동시에 처리 가능한 작업 수가 제한되어 있었으며, 이로 인해 이벤트 유입량이 처리량을 초과한 것으로 판단하였습니다.',
        '이에 따라 ai-queue로 전달되는 이벤트 생성 속도 역시 제한되었고, ai-queue에서 테스트 종료 이후 auto scaling이 발생한 것 역시 이러한 이유 때문으로 판단하였습니다.',
      ])}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text([
        '따라서 rule-worker의 처리량을 개선하는 방향으로 다음 버전을 진행하기로 결정하였습니다.',
      ])}
    `),
  ]
};
