// Recordings, rather than synthesized ambience. Source and recording licenses: music/SOURCES.json.
export const TRACKS={
 satie:{file:'gymnopedie-1',title:'Gymnopédie No. 1',composer:'Erik Satie',performer:'Robin Alciatore'},
 morning:{file:'morning',title:'Morning Mood',composer:'Edvard Grieg',performer:'Musopen Symphony Orchestra'},
 goldberg:{file:'goldberg',title:'Goldberg Variations: Aria',composer:'J. S. Bach',performer:'Shelley Katz'},
 andante:{file:'mozart-andante',title:'String Quartet No. 15: Andante',composer:'W. A. Mozart',performer:'Musopen String Quartet'},
 brahms:{file:'brahms-andante',title:'Symphony No. 1: Andante sostenuto',composer:'Johannes Brahms',performer:'Musopen Symphony Orchestra'},
 steppes:{file:'steppes',title:'In the Steppes of Central Asia',composer:'Alexander Borodin',performer:'Musopen Symphony Orchestra'},
 notturno:{file:'notturno',title:'String Quartet No. 2: Notturno',composer:'Alexander Borodin',performer:'Musopen String Quartet'},
 aase:{file:'aase',title:'Peer Gynt: Åse’s Death',composer:'Edvard Grieg',performer:'Musopen Symphony Orchestra'},
 scottish:{file:'scottish-adagio',title:'Scottish Symphony: Adagio',composer:'Felix Mendelssohn',performer:'Musopen Symphony Orchestra'}
};
// Palette identity is stable even when the campaign's presentation order changes.
export const CHAPTER_MUSIC=['goldberg','notturno','steppes','andante','scottish','satie','morning','andante','brahms','aase','goldberg','notturno','morning','scottish'];
export const musicForChapter=chapter=>TRACKS[CHAPTER_MUSIC[chapter]??'satie'];
