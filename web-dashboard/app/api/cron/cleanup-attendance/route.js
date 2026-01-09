/**
 * 미처리 출근 기록 자동 정리 API
 * - 크론잡으로 매일 자정에 호출
 * - 전날 이전의 미처리 출근 기록을 자동으로 근무시간 기록
 */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 동적 라우트로 설정 (request.headers 사용하므로 정적 빌드 불가)
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 미처리 출근 기록 처리
 * GET /api/cron/cleanup-attendance
 */
export async function GET(request) {
    // 크론잡 인증 확인 (선택사항 - 보안 강화용)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 로컬 시간 기준 오늘 날짜 (서버가 KST 설정이라도 일관성 유지)
        const getLocalDateString = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const today = getLocalDateString();

        // 오늘 이전에 출근했지만 check_out과 work_duration_minutes가 모두 없는 기록 조회
        const { data: unprocessedRecords, error: fetchError } = await supabase
            .from('attendance')
            .select('*')
            .lt('date', today)
            .is('check_out', null)
            .is('work_duration_minutes', null);

        if (fetchError) {
            console.error('미처리 출근 기록 조회 오류:', fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!unprocessedRecords || unprocessedRecords.length === 0) {
            console.log('미처리 출근 기록 없음');
            return NextResponse.json({
                message: '미처리 출근 기록 없음',
                processed: 0
            });
        }

        console.log(`미처리 출근 기록 ${unprocessedRecords.length}건 발견`);

        // 각 기록 처리
        const results = [];
        for (const record of unprocessedRecords) {
            try {
                // 근무 시간 계산 (출근 시간부터 해당 날짜 18시까지)
                const checkInTime = new Date(record.check_in);
                const assumedEndTime = new Date(record.date + 'T18:00:00');

                // 만약 출근 시간이 18시 이후면, 출근 시간 + 1시간으로 계산
                if (checkInTime.getHours() >= 18) {
                    assumedEndTime.setTime(checkInTime.getTime() + 60 * 60 * 1000);
                }

                const workMinutes = Math.max(0, Math.round((assumedEndTime - checkInTime) / 60000));

                // 근무시간 업데이트
                const { error: updateError } = await supabase
                    .from('attendance')
                    .update({
                        work_duration_minutes: workMinutes,
                        is_auto_check_out: true,
                    })
                    .eq('id', record.id);

                if (updateError) {
                    console.error(`기록 ${record.id} 업데이트 오류:`, updateError);
                    results.push({ id: record.id, status: 'error', error: updateError.message });
                } else {
                    console.log(`기록 ${record.id} 처리 완료: ${workMinutes}분`);
                    results.push({ id: record.id, status: 'success', workMinutes });
                }
            } catch (error) {
                console.error(`기록 ${record.id} 처리 중 오류:`, error);
                results.push({ id: record.id, status: 'error', error: error.message });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        return NextResponse.json({
            message: `처리 완료: ${successCount}건 성공, ${errorCount}건 실패`,
            processed: successCount,
            errors: errorCount,
            details: results,
        });

    } catch (error) {
        console.error('크론잡 오류:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
