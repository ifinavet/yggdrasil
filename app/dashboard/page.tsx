import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

const welcome_messages: { [key: number]: string } = {
    0: 'God søndag!',
    1: 'God mandag!',
    2: 'God tirsdag!',
    3: 'God onsdag!',
    4: 'God torsdag!',
    5: 'God fredag!',
    6: 'God lørdag!',
};

export default async function Dashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: member, error } = await supabase.from('member').select('id').eq('id', user?.id);

    if (!user && !member) {
        return redirect('/sign-in');
    }

    const dayOfTheWeek = new Date().getDay();

    return (
        <div>
            <h1>{welcome_messages[dayOfTheWeek]}</h1>
        </div>
    );
}
