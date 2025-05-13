import TitleUpdater from "./TitleUpdater";

const welcome_messages: { [key: number]: string } = {
    0: "God søndag!",
    1: "God mandag!",
    2: "God tirsdag!",
    3: "God onsdag!",
    4: "God torsdag!",
    5: "God fredag!",
    6: "God lørdag!",
};

export default async function Dashboard() {
    const dayOfTheWeek = new Date().getDay();

    return (
        <div>
            <TitleUpdater title='Velkommen naver, til bifrost' />
            <h1>{welcome_messages[dayOfTheWeek]}</h1>
            <p>Hei! Her kommer det noe kult!</p>
        </div>
    );
}
